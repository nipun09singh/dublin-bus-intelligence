"""Crowd Report Service — stores and aggregates passenger crowding reports.

Phase 4: Crowdsourcing pipeline. Passengers report crowding level via
one-tap UI (CrowdReportPanel). Reports are stored in Redis with TTL
and aggregated per route/vehicle.

Without Postgres, we store reports in Redis lists with a 1-hour TTL.
This gives us enough recency to show "what's happening now" on the map.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import structlog

from backend.core.redis import get_redis

logger = structlog.get_logger()

# Redis key patterns for crowd reports
REPORTS_LIST_KEY = "busiq:crowd:reports"
REPORTS_ROUTE_KEY = "busiq:crowd:route:{route_id}"
REPORTS_VEHICLE_KEY = "busiq:crowd:vehicle:{vehicle_id}"
REPORTS_COUNTER_KEY = "busiq:crowd:total_count"
REPORT_TTL = 3600  # 1 hour TTL for individual reports


@dataclass
class CrowdReportInput:
    """Incoming crowd report from a passenger."""
    vehicle_id: str
    route_id: str
    route_short_name: str
    crowding_level: str  # empty | seats | standing | full
    latitude: float
    longitude: float


@dataclass
class StoredCrowdReport:
    """A stored crowd report with metadata."""
    id: str
    vehicle_id: str
    route_id: str
    route_short_name: str
    crowding_level: str
    latitude: float
    longitude: float
    reported_at: str


@dataclass
class RouteCrowdingSummary:
    """Aggregated crowding for a route."""
    route_id: str
    route_short_name: str
    report_count: int
    latest_level: str
    levels: dict[str, int]  # e.g. {"empty": 2, "seats": 5, "standing": 3, "full": 1}
    avg_score: float  # 0-3 scale: empty=0, seats=1, standing=2, full=3


@dataclass
class CrowdingSnapshot:
    """Network-wide crowding overview."""
    total_reports: int
    reports_last_hour: int
    route_summaries: list[RouteCrowdingSummary] = field(default_factory=list)
    recent_reports: list[StoredCrowdReport] = field(default_factory=list)
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


LEVEL_SCORES = {"empty": 0, "seats": 1, "standing": 2, "full": 3}


async def submit_crowd_report(report: CrowdReportInput) -> StoredCrowdReport:
    """Store a new crowd report.

    Writes to:
    - Global reports list (for recent feed)
    - Per-route sorted set (for route-level aggregation)
    - Per-vehicle key (latest crowding for that specific bus)
    - Global counter (lifetime report count)
    """
    r = get_redis()
    now = datetime.now(timezone.utc)
    report_id = f"{report.vehicle_id}:{int(time.time() * 1000)}"

    stored = StoredCrowdReport(
        id=report_id,
        vehicle_id=report.vehicle_id,
        route_id=report.route_id,
        route_short_name=report.route_short_name,
        crowding_level=report.crowding_level,
        latitude=report.latitude,
        longitude=report.longitude,
        reported_at=now.isoformat(),
    )

    report_json = json.dumps({
        "id": stored.id,
        "vehicle_id": stored.vehicle_id,
        "route_id": stored.route_id,
        "route_short_name": stored.route_short_name,
        "crowding_level": stored.crowding_level,
        "latitude": stored.latitude,
        "longitude": stored.longitude,
        "reported_at": stored.reported_at,
    })

    pipe = r.pipeline()

    # Global list (most recent first, cap at 500)
    pipe.lpush(REPORTS_LIST_KEY, report_json)
    pipe.ltrim(REPORTS_LIST_KEY, 0, 499)
    pipe.expire(REPORTS_LIST_KEY, REPORT_TTL)

    # Per-route list
    route_key = REPORTS_ROUTE_KEY.format(route_id=report.route_id)
    pipe.lpush(route_key, report_json)
    pipe.ltrim(route_key, 0, 99)
    pipe.expire(route_key, REPORT_TTL)

    # Per-vehicle (latest only)
    vehicle_key = REPORTS_VEHICLE_KEY.format(vehicle_id=report.vehicle_id)
    pipe.set(vehicle_key, report_json, ex=REPORT_TTL)

    # Global counter
    pipe.incr(REPORTS_COUNTER_KEY)

    await pipe.execute()

    # Publish to WebSocket channel for live pulse feed
    from backend.core.redis import CHANNEL
    pulse_msg = json.dumps({
        "type": "crowd_report",
        "report": json.loads(report_json),
    })
    await r.publish(CHANNEL, pulse_msg)

    logger.info(
        "crowd.report_submitted",
        vehicle_id=report.vehicle_id,
        route=report.route_short_name,
        level=report.crowding_level,
    )

    return stored


async def get_recent_reports(limit: int = 20) -> list[StoredCrowdReport]:
    """Get the most recent crowd reports."""
    r = get_redis()
    raw_reports = await r.lrange(REPORTS_LIST_KEY, 0, limit - 1)

    reports = []
    for raw in raw_reports:
        try:
            data = json.loads(raw)
            reports.append(StoredCrowdReport(**data))
        except (json.JSONDecodeError, TypeError):
            continue

    return reports


async def get_crowding_snapshot() -> CrowdingSnapshot:
    """Get network-wide crowding overview."""
    r = get_redis()

    # Total lifetime reports
    total = await r.get(REPORTS_COUNTER_KEY)
    total_count = int(total) if total else 0

    # Recent reports
    recent = await get_recent_reports(50)

    # Aggregate by route
    route_agg: dict[str, dict[str, Any]] = {}
    for report in recent:
        rid = report.route_id
        if rid not in route_agg:
            route_agg[rid] = {
                "route_id": rid,
                "route_short_name": report.route_short_name,
                "levels": {"empty": 0, "seats": 0, "standing": 0, "full": 0},
                "latest_level": report.crowding_level,
            }
        route_agg[rid]["levels"][report.crowding_level] = (
            route_agg[rid]["levels"].get(report.crowding_level, 0) + 1
        )

    summaries = []
    for rid, agg in route_agg.items():
        levels = agg["levels"]
        count = sum(levels.values())
        score_sum = sum(LEVEL_SCORES.get(lvl, 0) * cnt for lvl, cnt in levels.items())
        avg_score = score_sum / count if count > 0 else 0

        summaries.append(
            RouteCrowdingSummary(
                route_id=rid,
                route_short_name=agg["route_short_name"],
                report_count=count,
                latest_level=agg["latest_level"],
                levels=levels,
                avg_score=round(avg_score, 2),
            )
        )

    # Sort by most reports first
    summaries.sort(key=lambda s: s.report_count, reverse=True)

    return CrowdingSnapshot(
        total_reports=total_count,
        reports_last_hour=len(recent),
        route_summaries=summaries,
        recent_reports=recent[:20],
    )


async def get_vehicle_crowding(vehicle_id: str) -> StoredCrowdReport | None:
    """Get the latest crowding report for a specific vehicle."""
    r = get_redis()
    vehicle_key = REPORTS_VEHICLE_KEY.format(vehicle_id=vehicle_id)
    raw = await r.get(vehicle_key)
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return StoredCrowdReport(**data)
    except (json.JSONDecodeError, TypeError):
        return None
