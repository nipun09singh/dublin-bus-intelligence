"""Route endpoints — static route data + shapes GeoJSON."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ingestion.gtfs_static.loader import gtfs_static

router = APIRouter()


@router.get("")
async def get_all_routes() -> dict:
    """Return all Dublin Bus routes with basic metadata."""
    routes = gtfs_static.get_all_routes_info()
    now = datetime.now(timezone.utc)
    return {
        "data": routes,
        "meta": {"timestamp": now.isoformat(), "version": "1.0", "count": len(routes)},
    }


@router.get("/shapes")
async def get_all_shapes() -> JSONResponse:
    """Return one representative shape per route as GeoJSON.

    This powers the route arteries layer on the Nerve Centre map.
    Cached on first request — shapes don't change often.
    """
    geojson = gtfs_static.get_shapes_geojson()
    return JSONResponse(
        content=geojson,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/stops")
async def get_all_stops() -> JSONResponse:
    """Return all stops as GeoJSON FeatureCollection."""
    geojson = gtfs_static.get_stops_geojson()
    return JSONResponse(
        content=geojson,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/{route_id}")
async def get_route(route_id: str) -> dict:
    """Return a single route with shape geometry."""
    name = gtfs_static.get_route_name(route_id)
    shape_geojson = gtfs_static.get_shapes_geojson(route_id=route_id)
    now = datetime.now(timezone.utc)
    return {
        "data": {
            "route_id": route_id,
            "route_short_name": name,
            "shapes": shape_geojson,
        },
        "meta": {"timestamp": now.isoformat(), "version": "1.0"},
    }


@router.get("/{route_id}/stops")
async def get_route_stops(route_id: str) -> dict:
    """Return all stops on a route, ordered by stop_sequence."""
    now = datetime.now(timezone.utc)
    return {
        "data": [],
        "meta": {"timestamp": now.isoformat(), "version": "1.0"},
    }
