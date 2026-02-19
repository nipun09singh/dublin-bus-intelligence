"""Network Health Score — real-time 0-100 composite health metric.

Aggregates multiple signals into a single number that tells a
Dublin Bus controller: "How healthy is my network RIGHT NOW?"

Components (weighted):
  - On-time performance (40%): % of buses within 5 min of schedule
  - Ghost bus rate (25%): % of expected routes with live vehicles
  - Bunching severity (20%): inverse of bunching pairs per 100 vehicles
  - Crowding stress (15%): ratio of high-crowding reports

Score interpretation:
  90-100: Excellent — network running smoothly
  75-89:  Good — minor issues, normal operations
  60-74:  Fair — attention needed, some interventions recommended
  40-59:  Poor — multiple issues, interventions critical
  0-39:   Crisis — major disruption, immediate action required
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any

import structlog

from backend.core.redis import get_redis, get_all_vehicles
from backend.services.ghost_detection import detect_ghost_buses
from backend.services.bunching_detection import detect_bunching
from backend.services.crowd_reports import get_crowding_snapshot
from ingestion.gtfs_static.loader import gtfs_static

logger = structlog.get_logger()

HEALTH_CACHE_KEY = "busiq:health:latest"
HEALTH_CACHE_TTL = 30  # Cache for 30 seconds


@dataclass
class HealthComponent:
    """A single component of the health score."""
    name: str
    score: float      # 0-100
    weight: float     # 0-1
    weighted: float   # score * weight
    detail: str       # Human-readable explanation


@dataclass
class RouteHealth:
    """Health summary for a single route."""
    route_id: str
    route_name: str
    live_vehicles: int
    on_time_count: int
    delayed_count: int
    ghost_vehicles: int
    bunching_pairs: int
    crowding_score: float   # 0-3
    health_score: float     # 0-100
    status: str             # "healthy" | "warning" | "critical"


@dataclass
class NetworkHealthReport:
    """Complete network health assessment."""
    score: int                                # 0-100 composite
    grade: str                                # A/B/C/D/F
    status: str                               # "excellent" | "good" | "fair" | "poor" | "crisis"
    components: list[HealthComponent]          # Breakdown
    top_routes: list[RouteHealth]             # Top 10 routes by health (best + worst)
    total_live_vehicles: int
    total_routes_active: int
    interventions_pending: int
    generated_at: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "grade": self.grade,
            "status": self.status,
            "components": [asdict(c) for c in self.components],
            "top_routes": [asdict(r) for r in self.top_routes],
            "total_live_vehicles": self.total_live_vehicles,
            "total_routes_active": self.total_routes_active,
            "interventions_pending": self.interventions_pending,
            "generated_at": self.generated_at,
        }


def _score_to_grade(score: int) -> tuple[str, str]:
    """Convert numeric score to letter grade and status."""
    if score >= 90:
        return "A", "excellent"
    elif score >= 75:
        return "B", "good"
    elif score >= 60:
        return "C", "fair"
    elif score >= 40:
        return "D", "poor"
    else:
        return "F", "crisis"


def _route_status(score: float) -> str:
    if score >= 75:
        return "healthy"
    elif score >= 50:
        return "warning"
    else:
        return "critical"


async def calculate_network_health() -> NetworkHealthReport:
    """Calculate the real-time Network Health Score.
    
    Runs all detectors and aggregates into a 0-100 score.
    Results are cached for 30 seconds.
    """
    # Check cache first
    r = get_redis()
    cached = await r.get(HEALTH_CACHE_KEY)
    if cached:
        try:
            data = json.loads(cached)
            return NetworkHealthReport(
                score=data["score"],
                grade=data["grade"],
                status=data["status"],
                components=[HealthComponent(**c) for c in data["components"]],
                top_routes=[RouteHealth(**rt) for rt in data["top_routes"]],
                total_live_vehicles=data["total_live_vehicles"],
                total_routes_active=data["total_routes_active"],
                interventions_pending=data["interventions_pending"],
                generated_at=data["generated_at"],
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            pass  # Recalculate

    # Gather all data
    vehicles = await get_all_vehicles()
    ghosts = await detect_ghost_buses()
    bunching = await detect_bunching()
    crowding = await get_crowding_snapshot()

    now = datetime.now(timezone.utc)
    total_vehicles = len(vehicles)

    # ─── Component 1: On-Time Performance (40%) ─── #
    on_time_count = 0
    slight_delay = 0
    severe_delay = 0
    for v in vehicles:
        delay = abs(v.get("delay_seconds", 0))
        if delay <= 300:  # Within 5 min
            on_time_count += 1
        elif delay <= 600:
            slight_delay += 1
        else:
            severe_delay += 1

    if total_vehicles > 0:
        on_time_pct = on_time_count / total_vehicles
        on_time_score = min(100, on_time_pct * 100)
    else:
        on_time_score = 50  # No data = neutral

    on_time_component = HealthComponent(
        name="On-Time Performance",
        score=round(on_time_score, 1),
        weight=0.40,
        weighted=round(on_time_score * 0.40, 1),
        detail=f"{on_time_count}/{total_vehicles} buses within 5 min of schedule"
    )

    # ─── Component 2: Ghost Bus Rate (25%) ─── #
    total_expected_routes = len(gtfs_static.route_map) if gtfs_static.route_map else 116
    routes_with_buses = ghosts.total_routes_with_buses
    if total_expected_routes > 0:
        coverage_pct = routes_with_buses / total_expected_routes
        # Only penalize if coverage < 80% (many routes only run peak hours)
        ghost_score = min(100, (coverage_pct / 0.5) * 100)  # 50% coverage = 100 score
    else:
        ghost_score = 50

    ghost_component = HealthComponent(
        name="Route Coverage",
        score=round(min(100, ghost_score), 1),
        weight=0.25,
        weighted=round(min(100, ghost_score) * 0.25, 1),
        detail=f"{routes_with_buses}/{total_expected_routes} routes have live vehicles"
    )

    # ─── Component 3: Bunching Severity (20%) ─── #
    if total_vehicles > 0:
        bunching_rate = bunching.total_pairs / max(1, total_vehicles / 10)
        bunching_score = max(0, 100 - bunching_rate * 25)  # Each pair per 10 buses = -25 points
    else:
        bunching_score = 100

    bunching_component = HealthComponent(
        name="Headway Regularity",
        score=round(bunching_score, 1),
        weight=0.20,
        weighted=round(bunching_score * 0.20, 1),
        detail=f"{bunching.total_pairs} bunching pairs across {bunching.routes_affected} routes"
    )

    # ─── Component 4: Crowding Stress (15%) ─── #
    full_reports = sum(
        s.levels.get("full", 0) for s in crowding.route_summaries
    )
    standing_reports = sum(
        s.levels.get("standing", 0) for s in crowding.route_summaries
    )
    total_reports = crowding.reports_last_hour

    if total_reports > 0:
        high_pct = (full_reports + standing_reports * 0.5) / total_reports
        crowding_score = max(0, 100 - high_pct * 100)
    else:
        crowding_score = 85  # No reports = assume ok

    crowding_component = HealthComponent(
        name="Passenger Comfort",
        score=round(crowding_score, 1),
        weight=0.15,
        weighted=round(crowding_score * 0.15, 1),
        detail=f"{full_reports} 'full' + {standing_reports} 'standing' out of {total_reports} reports"
    )

    # ─── Composite Score ─── #
    components = [on_time_component, ghost_component, bunching_component, crowding_component]
    raw_score = sum(c.weighted for c in components)
    score = max(0, min(100, int(round(raw_score))))
    grade, status = _score_to_grade(score)

    # ─── Per-Route Health ─── #
    route_vehicles: dict[str, list[dict]] = {}
    for v in vehicles:
        rid = v.get("route_id", "")
        if rid:
            route_vehicles.setdefault(rid, []).append(v)

    route_healths: list[RouteHealth] = []
    bunching_by_route = {a.route_id: a.pair_count for a in bunching.alerts}
    crowding_by_route = {s.route_id: s.avg_score for s in crowding.route_summaries}

    for rid, rvehicles in route_vehicles.items():
        n = len(rvehicles)
        on_time = sum(1 for v in rvehicles if abs(v.get("delay_seconds", 0)) <= 300)
        delayed = n - on_time
        route_bunch = bunching_by_route.get(rid, 0)
        route_crowd = crowding_by_route.get(rid, 0.0)

        # Simple per-route score
        if n > 0:
            r_on_time = (on_time / n) * 50
            r_bunch = max(0, 30 - route_bunch * 15)
            r_crowd = max(0, 20 - route_crowd * 5)
            r_score = r_on_time + r_bunch + r_crowd
        else:
            r_score = 0

        # Prefer the already-resolved route name from vehicle data
        # (resolved via trip_id lookup during ingestion — higher success rate)
        route_name = ""
        for v in rvehicles:
            rsn = v.get("route_short_name", "")
            if rsn and rsn != rid:
                route_name = rsn
                break
        if not route_name:
            route_name = gtfs_static.get_route_name(rid)
        route_healths.append(RouteHealth(
            route_id=rid,
            route_name=route_name,
            live_vehicles=n,
            on_time_count=on_time,
            delayed_count=delayed,
            ghost_vehicles=0,
            bunching_pairs=route_bunch,
            crowding_score=round(route_crowd, 2),
            health_score=round(r_score, 1),
            status=_route_status(r_score),
        ))

    # Sort: worst first (for display), take top 10
    route_healths.sort(key=lambda r: r.health_score)
    top_routes = route_healths[:10]

    # Count pending interventions
    from backend.services.intervention_engine import get_active_interventions
    try:
        active_interventions = await get_active_interventions()
        pending = sum(1 for i in active_interventions if i.get("status") == "pending")
    except Exception:
        pending = 0

    report = NetworkHealthReport(
        score=score,
        grade=grade,
        status=status,
        components=components,
        top_routes=top_routes,
        total_live_vehicles=total_vehicles,
        total_routes_active=len(route_vehicles),
        interventions_pending=pending,
        generated_at=now.isoformat(),
    )

    # Cache result
    await r.set(HEALTH_CACHE_KEY, json.dumps(report.to_dict()), ex=HEALTH_CACHE_TTL)

    logger.info(
        "health.calculated",
        score=score,
        grade=grade,
        vehicles=total_vehicles,
        routes=len(route_vehicles),
    )

    return report
