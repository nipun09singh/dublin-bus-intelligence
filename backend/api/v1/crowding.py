"""Crowd report endpoints — passenger crowdsourcing API.

Phase 4: Passengers submit crowding reports via one-tap UI.
Reports are stored in Redis with a 1-hour TTL and aggregated per route.
A community pulse WebSocket channel streams reports in real-time.
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import APIRouter, Query

from backend.services.crowd_reports import (
    CrowdReportInput,
    get_crowding_snapshot,
    get_recent_reports,
    get_vehicle_crowding,
    submit_crowd_report,
)

router = APIRouter()


@router.post("/report")
async def submit_report(report: dict) -> dict:
    """Submit a crowding report for a bus.

    One tap: vehicle_id, route_id, route_short_name, crowding_level, lat, lon.
    No authentication required — anonymous, geo-tagged, time-stamped.
    """
    crowd_input = CrowdReportInput(
        vehicle_id=report.get("vehicle_id", ""),
        route_id=report.get("route_id", ""),
        route_short_name=report.get("route_short_name", ""),
        crowding_level=report.get("crowding_level", "seats"),
        latitude=report.get("latitude", 0),
        longitude=report.get("longitude", 0),
    )

    stored = await submit_crowd_report(crowd_input)
    now = datetime.now(timezone.utc)

    return {
        "data": asdict(stored),
        "meta": {"timestamp": now.isoformat(), "version": "1.0"},
    }


@router.get("/snapshot")
async def crowding_snapshot() -> dict:
    """Get network-wide crowding overview.

    Returns: total report count, per-route summaries, recent reports.
    """
    snapshot = await get_crowding_snapshot()
    now = datetime.now(timezone.utc)

    return {
        "data": {
            "total_reports": snapshot.total_reports,
            "reports_last_hour": snapshot.reports_last_hour,
            "route_summaries": [asdict(s) for s in snapshot.route_summaries],
            "recent_reports": [asdict(r) for r in snapshot.recent_reports],
        },
        "meta": {"timestamp": now.isoformat(), "version": "1.0"},
    }


@router.get("/recent")
async def recent_reports(
    limit: int = Query(20, ge=1, le=100, description="Number of reports to return"),
) -> dict:
    """Get the most recent crowd reports (for the community pulse feed)."""
    reports = await get_recent_reports(limit)
    now = datetime.now(timezone.utc)

    return {
        "data": [asdict(r) for r in reports],
        "meta": {"timestamp": now.isoformat(), "version": "1.0", "count": len(reports)},
    }


@router.get("/vehicle/{vehicle_id}")
async def vehicle_crowding(vehicle_id: str) -> dict:
    """Get the latest crowding report for a specific vehicle."""
    report = await get_vehicle_crowding(vehicle_id)
    now = datetime.now(timezone.utc)

    return {
        "data": asdict(report) if report else None,
        "meta": {"timestamp": now.isoformat(), "version": "1.0"},
    }
