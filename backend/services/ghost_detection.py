"""Ghost Bus Detection Service.

Identifies 'ghost buses' — vehicles that should be running according
to the GTFS schedule but have no real-time signal.

Phase 3: Compares active trips (what SHOULD be running now based on
schedule) against live GTFS-RT vehicle positions (what IS running).
Any trip with no matching vehicle is a ghost.

For now, without stop_times.txt parsed, we use a simpler heuristic:
compare the set of route_ids that have scheduled trips vs which
route_ids have live vehicles. Routes with 0 live buses are flagged.

We also flag individual vehicles with stale data (>120s old) as
"signal-lost" ghost buses.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

import structlog

from backend.core.redis import get_all_vehicles
from ingestion.gtfs_static.loader import gtfs_static

logger = structlog.get_logger()

# Threshold: a vehicle with no update for this many seconds is a ghost
STALE_THRESHOLD_S = 120


@dataclass
class GhostBus:
    """A bus that's gone silent."""
    vehicle_id: str
    route_id: str
    route_short_name: str
    last_latitude: float
    last_longitude: float
    last_seen: str
    stale_seconds: int
    ghost_type: str  # "signal-lost" | "schedule-only"


@dataclass
class GhostRoute:
    """A route with no live vehicles at all."""
    route_id: str
    route_short_name: str


@dataclass
class GhostBusReport:
    """Full ghost bus analysis."""
    ghost_buses: list[GhostBus] = field(default_factory=list)
    ghost_routes: list[GhostRoute] = field(default_factory=list)
    total_live_vehicles: int = 0
    total_ghost_vehicles: int = 0
    total_routes_with_buses: int = 0
    total_routes_without_buses: int = 0
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


async def detect_ghost_buses() -> GhostBusReport:
    """Detect ghost buses in the current fleet.

    Two types of ghosts:
    1. Signal-lost: Vehicle was recently active but data is stale (>120s)
    2. Schedule-only: Route should have buses but has zero live vehicles

    Returns a GhostBusReport with both types.
    """
    vehicles = await get_all_vehicles()
    now = datetime.now(timezone.utc)

    ghost_buses: list[GhostBus] = []
    live_route_ids: set[str] = set()
    live_count = 0

    for v in vehicles:
        try:
            ts = datetime.fromisoformat(v["timestamp"].replace("Z", "+00:00"))
        except (ValueError, KeyError):
            ts = now

        age_s = int((now - ts).total_seconds())
        route_id = v.get("route_id", "")

        if age_s > STALE_THRESHOLD_S:
            # Signal-lost ghost
            ghost_buses.append(
                GhostBus(
                    vehicle_id=v.get("vehicle_id", ""),
                    route_id=route_id,
                    route_short_name=v.get("route_short_name", route_id),
                    last_latitude=v.get("latitude", 0),
                    last_longitude=v.get("longitude", 0),
                    last_seen=v.get("timestamp", ""),
                    stale_seconds=age_s,
                    ghost_type="signal-lost",
                )
            )
        else:
            live_count += 1
            if route_id:
                live_route_ids.add(route_id)

    # Find routes with zero live buses
    all_route_ids = set(gtfs_static.route_map.keys())
    ghost_route_ids = all_route_ids - live_route_ids

    ghost_routes = [
        GhostRoute(
            route_id=rid,
            route_short_name=gtfs_static.get_route_name(rid),
        )
        for rid in sorted(ghost_route_ids)
    ]

    return GhostBusReport(
        ghost_buses=ghost_buses,
        ghost_routes=ghost_routes,
        total_live_vehicles=live_count,
        total_ghost_vehicles=len(ghost_buses),
        total_routes_with_buses=len(live_route_ids),
        total_routes_without_buses=len(ghost_route_ids),
        generated_at=now,
    )
