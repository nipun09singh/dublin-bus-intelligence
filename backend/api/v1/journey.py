"""Journey planner API — multimodal route planning (Smart Cities pillar).

Endpoints:
- POST /api/v1/journey/plan — Plan a multimodal journey
- GET  /api/v1/journey/bikes — Dublin Bikes station availability
- GET  /api/v1/journey/luas/{stop_code} — Luas real-time forecast
- GET  /api/v1/journey/dart/{station_code} — DART real-time arrivals
- GET  /api/v1/journey/stops — All multimodal stops (Luas + DART + Bikes)
"""

from __future__ import annotations

import time
from dataclasses import asdict

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.services.dublin_bikes import dublin_bikes
from backend.services.luas import luas_state, LUAS_STOPS
from backend.services.dart import dart_state, DART_STATIONS
from backend.services.journey_planner import plan_journey

router = APIRouter()


class JourneyRequest(BaseModel):
    """Request body for journey planning."""

    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    origin_name: str = "Origin"
    dest_name: str = "Destination"


def _wrap(data: dict | list) -> dict:
    """Standard API response envelope."""
    return {
        "data": data,
        "meta": {"timestamp": time.time(), "version": "0.1.0"},
    }


@router.post("/plan")
async def plan_journey_endpoint(req: JourneyRequest):
    """Plan a multimodal journey between two points.

    Returns up to 3 journey options with segments, carbon savings, and real-time info.
    """
    options = await plan_journey(
        origin_lat=req.origin_lat,
        origin_lon=req.origin_lon,
        dest_lat=req.dest_lat,
        dest_lon=req.dest_lon,
        origin_name=req.origin_name,
        dest_name=req.dest_name,
    )

    serialised = []
    for opt in options:
        opt_dict = {
            "label": opt.label,
            "total_distance_km": opt.total_distance_km,
            "total_duration_minutes": opt.total_duration_minutes,
            "carbon": asdict(opt.carbon) if opt.carbon else None,
            "segments": [asdict(seg) for seg in opt.segments],
        }
        serialised.append(opt_dict)

    return _wrap(serialised)


@router.get("/bikes")
async def get_dublin_bikes():
    """Get all Dublin Bikes stations with real-time availability."""
    stations = await dublin_bikes.fetch()
    return _wrap({
        "stations": [asdict(s) for s in stations],
        "total": len(stations),
        "open": sum(1 for s in stations if s.status == "OPEN"),
        "total_bikes": sum(s.bikes_available for s in stations),
        "total_docks": sum(s.docks_available for s in stations),
    })


@router.get("/luas/{stop_code}")
async def get_luas_forecast(stop_code: str):
    """Get real-time Luas forecast for a stop."""
    forecasts = await luas_state.fetch_stop(stop_code.upper())
    return _wrap({
        "stop_code": stop_code.upper(),
        "forecasts": [asdict(f) for f in forecasts],
        "count": len(forecasts),
    })


@router.get("/dart/{station_code}")
async def get_dart_arrivals(station_code: str):
    """Get real-time DART arrivals for a station."""
    arrivals = await dart_state.fetch_station(station_code.upper())
    return _wrap({
        "station_code": station_code.upper(),
        "arrivals": [asdict(a) for a in arrivals],
        "count": len(arrivals),
    })


@router.get("/stops")
async def get_multimodal_stops():
    """Get all multimodal transit stops as GeoJSON for map rendering.

    Includes Luas stops, DART stations, and Dublin Bikes stations.
    """
    features = []

    # Luas stops
    for stop in LUAS_STOPS:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [stop["lon"], stop["lat"]],
            },
            "properties": {
                "id": f"luas-{stop['code']}",
                "name": stop["name"],
                "mode": "luas",
                "line": stop["line"],
                "code": stop["code"],
            },
        })

    # DART stations
    for station in DART_STATIONS:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [station["lon"], station["lat"]],
            },
            "properties": {
                "id": f"dart-{station['code']}",
                "name": station["name"],
                "mode": "dart",
                "type": station["type"],
                "code": station["code"],
            },
        })

    # Dublin Bikes stations (from cache, don't force fetch here)
    for s in dublin_bikes.stations:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [s.longitude, s.latitude],
            },
            "properties": {
                "id": f"bike-{s.station_id}",
                "name": s.name,
                "mode": "bike",
                "bikes_available": s.bikes_available,
                "docks_available": s.docks_available,
                "status": s.status,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }
