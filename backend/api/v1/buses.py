"""Bus / vehicle endpoints — live positions from Redis."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.core.redis import get_all_vehicles, get_vehicle, get_fleet_timestamp

router = APIRouter()


@router.get("")
async def get_all_buses() -> dict:
    """Return all live bus positions from Redis.

    This is the primary data source for the Nerve Centre map.
    Returns ~500-1100 vehicle positions with sub-3s freshness.
    """
    vehicles_data = await get_all_vehicles()
    now = datetime.now(timezone.utc)
    fleet_ts = await get_fleet_timestamp()

    return {
        "data": {
            "vehicles": vehicles_data,
            "count": len(vehicles_data),
            "timestamp": fleet_ts or now.isoformat(),
        },
        "meta": {
            "timestamp": now.isoformat(),
            "version": "1.0",
        },
    }


@router.get("/{vehicle_id}")
async def get_bus(vehicle_id: str) -> dict:
    """Return a single bus position by vehicle ID."""
    data = await get_vehicle(vehicle_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found")

    now = datetime.now(timezone.utc)
    return {
        "data": data,
        "meta": {
            "timestamp": now.isoformat(),
            "version": "1.0",
        },
    }
