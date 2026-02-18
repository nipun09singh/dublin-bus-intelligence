"""Bus / vehicle endpoints — live positions from Redis."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.models.schemas import ApiResponse, Meta, VehicleCollection, VehiclePosition

router = APIRouter()


@router.get("", response_model=ApiResponse)
async def get_all_buses() -> ApiResponse:
    """Return all live bus positions from Redis.

    This is the primary data source for the Nerve Centre map.
    Returns ~1,100 vehicle positions with sub-3s freshness.
    """
    # TODO: Read from Redis live state
    # Placeholder: return empty collection until ingestion is running
    now = datetime.now(timezone.utc)
    collection = VehicleCollection(vehicles=[], count=0, timestamp=now)
    return ApiResponse(data=collection, meta=Meta(timestamp=now))


@router.get("/{vehicle_id}", response_model=ApiResponse)
async def get_bus(vehicle_id: str) -> ApiResponse:
    """Return a single bus position by vehicle ID."""
    # TODO: Read from Redis by vehicle_id
    now = datetime.now(timezone.utc)
    # Placeholder: will raise VehicleNotFound when Redis is connected
    vehicle = VehiclePosition(
        vehicle_id=vehicle_id,
        route_id="--",
        latitude=53.3498,
        longitude=-6.2603,
        timestamp=now,
    )
    return ApiResponse(data=vehicle, meta=Meta(timestamp=now))
