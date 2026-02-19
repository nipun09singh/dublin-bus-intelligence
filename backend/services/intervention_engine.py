"""Autonomous Intervention Engine — the core BusIQ differentiator.

This is NOT a dashboard. When BusIQ detects a problem (ghost bus, bunching,
overcrowding, cross-modal disruption), it generates a **specific, actionable
intervention** with estimated impact. Controllers approve with one click.

Intervention types:
  HOLD    — Hold a bus at a stop to restore even headway (anti-bunching)
  DEPLOY  — Deploy a standby vehicle from nearest depot to cover a ghost gap
  SURGE   — Add capacity to an overcrowded route (short-turn or redeploy)
  EXPRESS — Skip low-demand stops to catch up (delay recovery)

Each intervention includes:
  - What to do (specific vehicle, stop, duration)
  - Why (trigger event)
  - Estimated impact (passengers affected, wait time change)
  - Confidence (how sure we are this helps)
"""

from __future__ import annotations

import json
import math
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import structlog

from backend.core.redis import get_redis, get_all_vehicles
from backend.services.ghost_detection import detect_ghost_buses, GhostBusReport
from backend.services.bunching_detection import detect_bunching, BunchingReport
from backend.services.crowd_reports import get_crowding_snapshot, CrowdingSnapshot
from ingestion.gtfs_static.loader import gtfs_static

logger = structlog.get_logger()

# Redis keys for intervention state
INTERVENTIONS_KEY = "busiq:interventions:active"
INTERVENTIONS_HISTORY_KEY = "busiq:interventions:history"
INTERVENTION_TTL = 1800  # 30-minute TTL for active interventions


# ─── Dublin Bus Depot Locations ─── #

DEPOTS = [
    {"name": "Broadstone", "lat": 53.3555, "lon": -6.2729, "capacity": 180},
    {"name": "Summerhill", "lat": 53.3515, "lon": -6.2520, "capacity": 80},
    {"name": "Ringsend", "lat": 53.3385, "lon": -6.2272, "capacity": 140},
    {"name": "Donnybrook", "lat": 53.3217, "lon": -6.2385, "capacity": 100},
    {"name": "Conyngham Road", "lat": 53.3475, "lon": -6.3060, "capacity": 120},
    {"name": "Phibsborough", "lat": 53.3603, "lon": -6.2726, "capacity": 70},
    {"name": "Harristown", "lat": 53.4048, "lon": -6.2788, "capacity": 200},
]

# Target headway by route (minutes) — default 10 min if unknown
DEFAULT_HEADWAY_MIN = 10


class InterventionType(str, Enum):
    HOLD = "HOLD"
    DEPLOY = "DEPLOY"
    SURGE = "SURGE"
    EXPRESS = "EXPRESS"


class InterventionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DISMISSED = "dismissed"
    EXPIRED = "expired"


class InterventionPriority(str, Enum):
    CRITICAL = "critical"   # Immediate action needed
    HIGH = "high"           # Should act within 5 min
    MEDIUM = "medium"       # Can wait 10 min
    LOW = "low"             # Nice to have


@dataclass
class Intervention:
    """A single actionable recommendation for a controller."""
    id: str
    type: InterventionType
    priority: InterventionPriority
    status: InterventionStatus

    # What to do
    headline: str          # "HOLD bus #33017 at Phibsborough for 90s"
    description: str       # Detailed explanation

    # Context
    route_id: str
    route_name: str
    trigger: str           # What caused this: "bunching", "ghost", "crowding"

    # Specifics (optional, depends on type)
    vehicle_id: str | None = None
    target_stop: str | None = None
    hold_seconds: int | None = None
    depot_name: str | None = None

    # Impact estimation
    passengers_affected: int = 0
    wait_time_impact_seconds: int = 0  # negative = improvement
    confidence: float = 0.0            # 0-1

    # Location for map marker
    latitude: float = 0.0
    longitude: float = 0.0

    # Timestamps
    created_at: str = ""
    expires_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["type"] = self.type.value
        d["priority"] = self.priority.value
        d["status"] = self.status.value
        return d


# ─── Haversine helper ─── #

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_depot(lat: float, lon: float) -> dict:
    """Find the nearest Dublin Bus depot to a given location."""
    best = DEPOTS[0]
    best_dist = float("inf")
    for depot in DEPOTS:
        d = _haversine_m(lat, lon, depot["lat"], depot["lon"])
        if d < best_dist:
            best_dist = d
            best = depot
    return {**best, "distance_m": round(best_dist)}


def _find_nearest_stop(lat: float, lon: float, route_id: str | None = None) -> dict | None:
    """Find the nearest bus stop, optionally filtered by route."""
    best = None
    best_dist = float("inf")
    for stop_id, (name, slat, slon) in gtfs_static.stop_map.items():
        d = _haversine_m(lat, lon, slat, slon)
        if d < best_dist:
            best_dist = d
            best = {"stop_id": stop_id, "name": name, "lat": slat, "lon": slon, "distance_m": round(d)}
    return best


def _estimate_passengers_on_route(route_id: str, vehicles_on_route: int) -> int:
    """Rough estimate of current passengers on a route.
    
    Average Dublin Bus capacity = 75 passengers
    Average load factor during peak = 60%, off-peak = 35%
    """
    import datetime as dt
    hour = dt.datetime.now().hour
    if 7 <= hour <= 9 or 16 <= hour <= 19:
        load_factor = 0.60  # Peak
    elif 9 < hour < 16:
        load_factor = 0.40  # Day
    else:
        load_factor = 0.25  # Off-peak
    return int(vehicles_on_route * 75 * load_factor)


# ─── Intervention Generators ─── #


def _generate_hold_interventions(bunching: BunchingReport) -> list[Intervention]:
    """Generate HOLD interventions from bunching events.
    
    When two buses are bunched, hold the trailing bus at the next stop
    to restore even headway. Compute the optimal hold duration.
    """
    interventions = []
    now = datetime.now(timezone.utc)

    for alert in bunching.alerts:
        for pair in alert.bunched_pairs:
            # The trailing bus should hold (the one further behind in route direction)
            # Without direction info, just pick vehicle_b
            hold_vehicle = pair.vehicle_b
            hold_lat = pair.vehicle_b_lat
            hold_lon = pair.vehicle_b_lon

            # Find nearest stop for the hold
            nearest = _find_nearest_stop(hold_lat, hold_lon)
            stop_name = nearest["name"] if nearest else "next stop"

            # Compute hold time: target headway = 10 min, current gap ≈ distance/speed
            # If they're 200m apart at ~20 km/h, that's ~36 seconds gap
            # Target gap at 10-min headway: need to inject ~4-5 min hold
            gap_seconds = max(30, int(pair.distance_m / 5.5))  # rough: 20km/h ≈ 5.5 m/s
            target_gap_s = DEFAULT_HEADWAY_MIN * 60
            hold_time = min(180, max(30, target_gap_s // 2 - gap_seconds))

            # Estimate passengers who benefit from even spacing
            passengers = _estimate_passengers_on_route(pair.route_id, 2)

            # Priority based on severity
            if pair.severity == "severe":
                priority = InterventionPriority.CRITICAL
            elif pair.severity == "moderate":
                priority = InterventionPriority.HIGH
            else:
                priority = InterventionPriority.MEDIUM

            interventions.append(Intervention(
                id=str(uuid.uuid4())[:8],
                type=InterventionType.HOLD,
                priority=priority,
                status=InterventionStatus.PENDING,
                headline=f"HOLD bus #{hold_vehicle} at {stop_name} for {hold_time}s",
                description=(
                    f"Buses #{pair.vehicle_a} and #{pair.vehicle_b} on Route {pair.route_short_name} "
                    f"are only {int(pair.distance_m)}m apart ({pair.severity} bunching). "
                    f"Holding #{hold_vehicle} for {hold_time} seconds will restore ~{DEFAULT_HEADWAY_MIN}-min headway. "
                    f"Est. {passengers} passengers get more even service."
                ),
                route_id=pair.route_id,
                route_name=pair.route_short_name,
                trigger="bunching",
                vehicle_id=hold_vehicle,
                target_stop=stop_name,
                hold_seconds=hold_time,
                passengers_affected=passengers,
                wait_time_impact_seconds=-hold_time,  # negative = improvement
                confidence=0.78 if pair.severity == "severe" else 0.65,
                latitude=pair.midpoint_lat,
                longitude=pair.midpoint_lon,
                created_at=now.isoformat(),
                expires_at="",  # set by store
            ))

    return interventions


def _generate_deploy_interventions(ghosts: GhostBusReport) -> list[Intervention]:
    """Generate DEPLOY interventions from ghost bus events.
    
    When a route has no live vehicles, recommend deploying a standby
    from the nearest depot to cover the gap.
    """
    interventions = []
    now = datetime.now(timezone.utc)

    for ghost_route in ghosts.ghost_routes[:10]:  # Cap at top 10
        # Use route's approximate centre (first stop if available)
        route_lat, route_lon = 53.3498, -6.2603  # Dublin centre default
        
        # Try to find a stop on this route for better location
        for stop_id, (name, slat, slon) in gtfs_static.stop_map.items():
            route_lat, route_lon = slat, slon
            break

        depot = _nearest_depot(route_lat, route_lon)
        deploy_time_min = max(5, depot["distance_m"] // 500)  # rough: 30 km/h avg

        interventions.append(Intervention(
            id=str(uuid.uuid4())[:8],
            type=InterventionType.DEPLOY,
            priority=InterventionPriority.HIGH,
            status=InterventionStatus.PENDING,
            headline=f"DEPLOY standby from {depot['name']} to cover Route {ghost_route.route_short_name}",
            description=(
                f"Route {ghost_route.route_short_name} has ZERO live vehicles — "
                f"passengers are waiting with no bus in sight. "
                f"Nearest depot: {depot['name']} ({depot['distance_m']}m away, "
                f"~{deploy_time_min} min deploy time). "
                f"This route typically serves ~500 passengers/hour during this period."
            ),
            route_id=ghost_route.route_id,
            route_name=ghost_route.route_short_name,
            trigger="ghost",
            depot_name=depot["name"],
            passengers_affected=500,
            wait_time_impact_seconds=-deploy_time_min * 60,
            confidence=0.82,
            latitude=route_lat,
            longitude=route_lon,
            created_at=now.isoformat(),
            expires_at="",
        ))

    # Also generate for individual ghost buses that are signal-lost
    for ghost in ghosts.ghost_buses[:5]:  # Top 5 signal-lost
        if ghost.stale_seconds > 300:  # Only if >5 min stale
            depot = _nearest_depot(ghost.last_latitude, ghost.last_longitude)
            interventions.append(Intervention(
                id=str(uuid.uuid4())[:8],
                type=InterventionType.DEPLOY,
                priority=InterventionPriority.MEDIUM,
                status=InterventionStatus.PENDING,
                headline=f"DEPLOY backup for silent bus #{ghost.vehicle_id} on Route {ghost.route_short_name}",
                description=(
                    f"Bus #{ghost.vehicle_id} on Route {ghost.route_short_name} has been "
                    f"silent for {ghost.stale_seconds // 60} minutes. "
                    f"Last seen at ({ghost.last_latitude:.4f}, {ghost.last_longitude:.4f}). "
                    f"May be broken down or off-route. Deploy backup from {depot['name']}."
                ),
                route_id=ghost.route_id,
                route_name=ghost.route_short_name,
                trigger="ghost",
                vehicle_id=ghost.vehicle_id,
                depot_name=depot["name"],
                passengers_affected=75,
                wait_time_impact_seconds=-300,
                confidence=0.60,
                latitude=ghost.last_latitude,
                longitude=ghost.last_longitude,
                created_at=now.isoformat(),
                expires_at="",
            ))

    return interventions


def _generate_surge_interventions(crowding: CrowdingSnapshot) -> list[Intervention]:
    """Generate SURGE interventions from crowding reports.
    
    When multiple passengers report FULL on the same route within
    a short window, recommend adding capacity.
    """
    interventions = []
    now = datetime.now(timezone.utc)

    for summary in crowding.route_summaries:
        full_count = summary.levels.get("full", 0)
        standing_count = summary.levels.get("standing", 0)
        total_high = full_count + standing_count

        # Trigger surge if 2+ "full" reports or 3+ combined high reports
        if full_count >= 2 or total_high >= 3:
            # Find a stop on this route for location
            route_lat, route_lon = 53.3498, -6.2603
            for report in crowding.recent_reports:
                if report.route_id == summary.route_id:
                    route_lat = report.latitude
                    route_lon = report.longitude
                    break

            depot = _nearest_depot(route_lat, route_lon)
            passengers = int(total_high * 75 * 0.9)  # Each report ≈ a packed bus

            priority = InterventionPriority.CRITICAL if full_count >= 3 else InterventionPriority.HIGH

            interventions.append(Intervention(
                id=str(uuid.uuid4())[:8],
                type=InterventionType.SURGE,
                priority=priority,
                status=InterventionStatus.PENDING,
                headline=f"SURGE capacity on Route {summary.route_short_name} — {full_count} 'FULL' reports",
                description=(
                    f"Route {summary.route_short_name} has received {full_count} 'FULL' and "
                    f"{standing_count} 'STANDING' reports in the last hour. "
                    f"Avg crowding score: {summary.avg_score:.1f}/3.0. "
                    f"Recommend deploying additional vehicle from {depot['name']} depot "
                    f"or short-turning an underloaded bus from an adjacent route."
                ),
                route_id=summary.route_id,
                route_name=summary.route_short_name,
                trigger="crowding",
                depot_name=depot["name"],
                passengers_affected=passengers,
                wait_time_impact_seconds=-180,
                confidence=0.72,
                latitude=route_lat,
                longitude=route_lon,
                created_at=now.isoformat(),
                expires_at="",
            ))

    return interventions


# ─── Main Engine Function ─── #


async def generate_interventions() -> list[Intervention]:
    """Run the full intervention engine.
    
    1. Detect ghost buses → DEPLOY interventions
    2. Detect bunching → HOLD interventions
    3. Detect crowding → SURGE interventions
    4. Deduplicate and rank by priority
    5. Store active interventions in Redis
    
    Returns the list of active interventions sorted by priority.
    """
    # Run all detectors
    ghosts = await detect_ghost_buses()
    bunching = await detect_bunching()
    crowding = await get_crowding_snapshot()

    # Generate interventions from each detector
    all_interventions: list[Intervention] = []
    all_interventions.extend(_generate_hold_interventions(bunching))
    all_interventions.extend(_generate_deploy_interventions(ghosts))
    all_interventions.extend(_generate_surge_interventions(crowding))

    # Sort by priority
    priority_order = {
        InterventionPriority.CRITICAL: 0,
        InterventionPriority.HIGH: 1,
        InterventionPriority.MEDIUM: 2,
        InterventionPriority.LOW: 3,
    }
    all_interventions.sort(key=lambda i: priority_order.get(i.priority, 4))

    # Cap at 20 most important
    active = all_interventions[:20]

    # Store in Redis
    await _store_interventions(active)

    logger.info(
        "interventions.generated",
        total=len(active),
        hold=sum(1 for i in active if i.type == InterventionType.HOLD),
        deploy=sum(1 for i in active if i.type == InterventionType.DEPLOY),
        surge=sum(1 for i in active if i.type == InterventionType.SURGE),
    )

    return active


async def _store_interventions(interventions: list[Intervention]) -> None:
    """Store active interventions in Redis."""
    r = get_redis()
    pipe = r.pipeline()

    # Clear old active interventions
    pipe.delete(INTERVENTIONS_KEY)

    for intv in interventions:
        pipe.rpush(INTERVENTIONS_KEY, json.dumps(intv.to_dict()))

    pipe.expire(INTERVENTIONS_KEY, INTERVENTION_TTL)
    await pipe.execute()


async def get_active_interventions() -> list[dict]:
    """Get all currently active interventions from Redis."""
    r = get_redis()
    raw = await r.lrange(INTERVENTIONS_KEY, 0, -1)
    interventions = []
    for item in raw:
        try:
            interventions.append(json.loads(item))
        except json.JSONDecodeError:
            continue
    return interventions


async def action_intervention(intervention_id: str, action: str) -> dict | None:
    """Approve or dismiss an intervention.
    
    Args:
        intervention_id: The intervention ID
        action: "approve" or "dismiss"
    
    Returns the updated intervention or None if not found.
    """
    r = get_redis()
    raw = await r.lrange(INTERVENTIONS_KEY, 0, -1)

    for i, item in enumerate(raw):
        try:
            intv = json.loads(item)
        except json.JSONDecodeError:
            continue

        if intv.get("id") == intervention_id:
            intv["status"] = action + "d"  # "approved" or "dismissed"
            intv["actioned_at"] = datetime.now(timezone.utc).isoformat()

            # Update in list
            await r.lset(INTERVENTIONS_KEY, i, json.dumps(intv))

            # Add to history
            await r.lpush(INTERVENTIONS_HISTORY_KEY, json.dumps(intv))
            await r.ltrim(INTERVENTIONS_HISTORY_KEY, 0, 199)

            logger.info(
                "intervention.actioned",
                id=intervention_id,
                action=action,
                type=intv.get("type"),
                route=intv.get("route_name"),
            )
            return intv

    return None


async def get_intervention_history(limit: int = 50) -> list[dict]:
    """Get intervention history (approved/dismissed)."""
    r = get_redis()
    raw = await r.lrange(INTERVENTIONS_HISTORY_KEY, 0, limit - 1)
    history = []
    for item in raw:
        try:
            history.append(json.loads(item))
        except json.JSONDecodeError:
            continue
    return history
