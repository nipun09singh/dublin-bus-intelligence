"""Route endpoints — static route data + live health metrics."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.models.schemas import ApiResponse, Meta

router = APIRouter()


@router.get("")
async def get_all_routes() -> ApiResponse:
    """Return all Dublin Bus routes with basic metadata."""
    # TODO: Query from PostgreSQL (loaded from GTFS static)
    now = datetime.now(timezone.utc)
    return ApiResponse(data=[], meta=Meta(timestamp=now))


@router.get("/{route_id}")
async def get_route(route_id: str) -> ApiResponse:
    """Return a single route with shape geometry and stops."""
    # TODO: Query from PostgreSQL with PostGIS shape
    now = datetime.now(timezone.utc)
    return ApiResponse(data={"route_id": route_id}, meta=Meta(timestamp=now))


@router.get("/{route_id}/stops")
async def get_route_stops(route_id: str) -> ApiResponse:
    """Return all stops on a route, ordered by stop_sequence."""
    # TODO: Query from PostgreSQL
    now = datetime.now(timezone.utc)
    return ApiResponse(data=[], meta=Meta(timestamp=now))
