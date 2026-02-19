"""Bunching Detection Service.

Identifies bus bunching — when two or more buses on the same route
are too close together, indicating service irregularity.

Phase 3: Real-time detection with severity scoring.
Bunching hurts passengers: the lead bus gets overcrowded while
the trailing bus runs empty. This is the #1 optimization target.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone

import structlog

from backend.core.redis import get_all_vehicles

logger = structlog.get_logger()

# Two buses within this distance (meters) on the same route = bunching
BUNCH_THRESHOLD_M = 400
# Severe bunching threshold
SEVERE_THRESHOLD_M = 200


@dataclass
class BunchingPair:
    """Two buses that are bunched together."""
    vehicle_a: str
    vehicle_b: str
    route_id: str
    route_short_name: str
    distance_m: float
    severity: str  # "mild" | "moderate" | "severe"
    midpoint_lat: float
    midpoint_lon: float
    vehicle_a_lat: float
    vehicle_a_lon: float
    vehicle_b_lat: float
    vehicle_b_lon: float


@dataclass
class BunchingAlert:
    """Alert for a bunching event on a route."""
    route_id: str
    route_short_name: str
    pair_count: int
    worst_distance_m: float
    severity: str
    bunched_pairs: list[BunchingPair]


@dataclass
class BunchingReport:
    """Full bunching analysis for the network."""
    alerts: list[BunchingAlert] = field(default_factory=list)
    total_pairs: int = 0
    routes_affected: int = 0
    total_live_vehicles: int = 0
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters."""
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


async def detect_bunching() -> BunchingReport:
    """Detect all bunching events in the current fleet.

    Groups vehicles by route, checks pairwise distances.
    Returns alerts sorted by severity (worst first).
    """
    vehicles = await get_all_vehicles()
    now = datetime.now(timezone.utc)

    # Group by route
    route_groups: dict[str, list[dict]] = {}
    for v in vehicles:
        rid = v.get("route_id", "")
        if rid:
            route_groups.setdefault(rid, []).append(v)

    all_alerts: list[BunchingAlert] = []
    total_pairs = 0

    for route_id, buses in route_groups.items():
        if len(buses) < 2:
            continue

        pairs: list[BunchingPair] = []

        # Check all pairs on this route
        for i in range(len(buses)):
            for j in range(i + 1, len(buses)):
                a, b = buses[i], buses[j]
                dist = _haversine_m(
                    a["latitude"], a["longitude"],
                    b["latitude"], b["longitude"],
                )

                if dist < BUNCH_THRESHOLD_M:
                    if dist < SEVERE_THRESHOLD_M:
                        severity = "severe"
                    elif dist < 300:
                        severity = "moderate"
                    else:
                        severity = "mild"

                    pairs.append(
                        BunchingPair(
                            vehicle_a=a["vehicle_id"],
                            vehicle_b=b["vehicle_id"],
                            route_id=route_id,
                            route_short_name=a.get("route_short_name", route_id),
                            distance_m=round(dist, 1),
                            severity=severity,
                            midpoint_lat=(a["latitude"] + b["latitude"]) / 2,
                            midpoint_lon=(a["longitude"] + b["longitude"]) / 2,
                            vehicle_a_lat=a["latitude"],
                            vehicle_a_lon=a["longitude"],
                            vehicle_b_lat=b["latitude"],
                            vehicle_b_lon=b["longitude"],
                        )
                    )

        if pairs:
            worst = min(pairs, key=lambda p: p.distance_m)
            alert = BunchingAlert(
                route_id=route_id,
                route_short_name=pairs[0].route_short_name,
                pair_count=len(pairs),
                worst_distance_m=worst.distance_m,
                severity=worst.severity,
                bunched_pairs=pairs,
            )
            all_alerts.append(alert)
            total_pairs += len(pairs)

    # Sort by severity: severe first, then by worst distance
    severity_order = {"severe": 0, "moderate": 1, "mild": 2}
    all_alerts.sort(key=lambda a: (severity_order.get(a.severity, 3), a.worst_distance_m))

    return BunchingReport(
        alerts=all_alerts,
        total_pairs=total_pairs,
        routes_affected=len(all_alerts),
        total_live_vehicles=len(vehicles),
        generated_at=now,
    )
