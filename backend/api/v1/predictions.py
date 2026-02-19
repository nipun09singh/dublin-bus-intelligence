"""Prediction endpoints — ETA predictions, ghost bus detection, bunching alerts."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import APIRouter, Query

from backend.services.predictions import predict_stop_arrivals
from backend.services.ghost_detection import detect_ghost_buses
from backend.services.bunching_detection import detect_bunching

router = APIRouter()


@router.get("/eta/{stop_id}")
async def predict_eta(
    stop_id: str,
    route_id: str = Query(None, description="Filter to a specific route"),
) -> dict:
    """Predict upcoming bus arrivals at a stop.

    Returns a list of predicted arrivals sorted by ETA (nearest first).
    Uses heuristic model (v1): distance + speed + delay adjustment.
    """
    result = await predict_stop_arrivals(stop_id, route_id)
    now = datetime.now(timezone.utc)

    return {
        "data": {
            "stop_id": result.stop_id,
            "stop_name": result.stop_name,
            "latitude": result.latitude,
            "longitude": result.longitude,
            "predictions": [asdict(p) for p in result.predictions],
        },
        "meta": {
            "timestamp": now.isoformat(),
            "version": "1.0",
            "model": "heuristic-v1",
            "count": len(result.predictions),
        },
    }


@router.get("/ghosts")
async def get_ghost_buses() -> dict:
    """Detect ghost buses — vehicles with no signal or routes with no buses.

    Two types:
    - signal-lost: Vehicle was active but data is stale (>120s)
    - schedule-only: Route should have buses but has zero live vehicles
    """
    report = await detect_ghost_buses()
    now = datetime.now(timezone.utc)

    return {
        "data": {
            "ghost_buses": [asdict(g) for g in report.ghost_buses],
            "ghost_routes": [asdict(r) for r in report.ghost_routes],
            "summary": {
                "total_live_vehicles": report.total_live_vehicles,
                "total_ghost_vehicles": report.total_ghost_vehicles,
                "total_routes_with_buses": report.total_routes_with_buses,
                "total_routes_without_buses": report.total_routes_without_buses,
            },
        },
        "meta": {"timestamp": now.isoformat(), "version": "1.0"},
    }


@router.get("/bunching")
async def get_bunching_alerts() -> dict:
    """Detect bus bunching — same-route buses too close together.

    Returns alerts sorted by severity (severe first).
    Threshold: <400m between two buses on the same route.
    """
    report = await detect_bunching()
    now = datetime.now(timezone.utc)

    return {
        "data": {
            "alerts": [asdict(a) for a in report.alerts],
            "summary": {
                "total_pairs": report.total_pairs,
                "routes_affected": report.routes_affected,
                "total_live_vehicles": report.total_live_vehicles,
            },
        },
        "meta": {"timestamp": now.isoformat(), "version": "1.0"},
    }


@router.post("")
async def predict_arrival_legacy(request: dict) -> dict:
    """Legacy prediction endpoint — forwards to /eta/{stop_id}."""
    stop_id = request.get("stop_id", "")
    route_id = request.get("route_id")
    result = await predict_stop_arrivals(stop_id, route_id)
    now = datetime.now(timezone.utc)
    return {
        "data": {
            "stop_id": result.stop_id,
            "stop_name": result.stop_name,
            "predictions": [asdict(p) for p in result.predictions],
        },
        "meta": {"timestamp": now.isoformat(), "version": "1.0"},
    }
