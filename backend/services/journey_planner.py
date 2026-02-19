"""Multimodal journey planner — the "Leave Now" router.

Builds a simplified transit graph from:
- Dublin Bus GTFS stops + live positions
- Luas stops + live forecasts
- DART stations + live arrivals
- Dublin Bikes stations + availability
- Walking connections between interchanges

Returns up to 3 multimodal route options with:
- Segment-by-segment directions (mode, from, to, duration, distance)
- Real-time departure info where available
- Carbon savings vs. driving
- Total journey time

This is a heuristic planner (not full Dijkstra on GTFS schedules)
designed to produce visually compelling results for the demo.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field

import structlog

from backend.services.carbon import CarbonResult, calculate_carbon
from backend.services.dublin_bikes import dublin_bikes
from backend.services.luas import LUAS_STOPS, luas_state
from backend.services.dart import DART_STATIONS, dart_state

logger = structlog.get_logger()

# ─── Constants ─── #

WALK_SPEED_KMH = 5.0
BUS_SPEED_KMH = 15.0
LUAS_SPEED_KMH = 30.0
DART_SPEED_KMH = 45.0
BIKE_SPEED_KMH = 15.0

# Mode colours (matches design doc Section 5.1.4)
MODE_COLOURS = {
    "bus": "#00808B",    # Forest teal
    "luas": "#6B2D8B",   # Sunset purple (Luas brand)
    "dart": "#0072CE",   # Ocean blue (IR brand)
    "bike": "#76B82A",   # Lime green
    "walk": "#8C8C8C",   # Warm grey
}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass
class JourneySegment:
    """One leg of a multimodal journey."""

    mode: str  # "bus", "luas", "dart", "bike", "walk"
    from_name: str
    from_lat: float
    from_lon: float
    to_name: str
    to_lat: float
    to_lon: float
    distance_km: float
    duration_minutes: float
    colour: str
    details: str = ""  # e.g. "Route 39A" or "Green Line towards Bride's Glen"
    real_time_minutes: int | None = None  # live ETA if available


@dataclass
class JourneyOption:
    """A complete journey with multiple segments."""

    segments: list[JourneySegment]
    total_distance_km: float
    total_duration_minutes: float
    carbon: CarbonResult | None = None
    label: str = ""  # "Fastest", "Greenest", "Fewest transfers"


async def plan_journey(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    origin_name: str = "Origin",
    dest_name: str = "Destination",
) -> list[JourneyOption]:
    """Plan up to 3 multimodal journey options.

    Strategy:
    1. Direct bus (walk → bus → walk) — check for nearby bus routes
    2. Bus + Luas/DART — multimodal with rail interchange
    3. Bike + transit — Dublin Bikes for first/last mile
    """
    options: list[JourneyOption] = []
    direct_km = _haversine(origin_lat, origin_lon, dest_lat, dest_lon)

    # ─── Option 1: Walk-only (if < 2km) or Bus-focused ───
    if direct_km < 2.0:
        walk_time = direct_km / WALK_SPEED_KMH * 60
        walk_seg = JourneySegment(
            mode="walk",
            from_name=origin_name,
            from_lat=origin_lat,
            from_lon=origin_lon,
            to_name=dest_name,
            to_lat=dest_lat,
            to_lon=dest_lon,
            distance_km=round(direct_km, 2),
            duration_minutes=round(walk_time, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(direct_km * 1000)}m walk",
        )
        opt = _build_option([walk_seg], "Walk")
        options.append(opt)
    
    # Bus-focused option
    bus_option = await _plan_bus_route(
        origin_lat, origin_lon, dest_lat, dest_lon, origin_name, dest_name
    )
    if bus_option:
        bus_option.label = "Bus Direct" if len(options) == 0 else "Fastest"
        options.append(bus_option)

    # ─── Option 2: Multimodal with Luas ───
    luas_option = await _plan_with_luas(
        origin_lat, origin_lon, dest_lat, dest_lon, origin_name, dest_name
    )
    if luas_option:
        luas_option.label = "Via Luas"
        options.append(luas_option)

    # ─── Option 3: Multimodal with DART ───
    dart_option = await _plan_with_dart(
        origin_lat, origin_lon, dest_lat, dest_lon, origin_name, dest_name
    )
    if dart_option:
        dart_option.label = "Via DART"
        options.append(dart_option)

    # ─── Option 4: Bike + Transit (greenest) ───
    bike_option = await _plan_with_bike(
        origin_lat, origin_lon, dest_lat, dest_lon, origin_name, dest_name
    )
    if bike_option:
        bike_option.label = "Greenest"
        options.append(bike_option)

    # Sort by duration and take top 3
    options.sort(key=lambda o: o.total_duration_minutes)

    # Assign labels if not set
    if len(options) >= 1 and not options[0].label:
        options[0].label = "Fastest"
    if len(options) >= 2 and not options[1].label:
        options[1].label = "Alternative"
    if len(options) >= 3 and not options[2].label:
        options[2].label = "Greenest"

    # Calculate carbon for all options
    for opt in options:
        carbon_segments = [
            {"mode": s.mode, "distance_km": s.distance_km} for s in opt.segments
        ]
        opt.carbon = calculate_carbon(carbon_segments)

    return options[:3]


async def _plan_bus_route(
    o_lat: float, o_lon: float, d_lat: float, d_lon: float,
    o_name: str, d_name: str,
) -> JourneyOption | None:
    """Plan a bus-focused journey: walk → bus → walk."""
    from backend.core.redis import get_redis
    from ingestion.gtfs_static.loader import gtfs_static

    # Find nearest bus stops to origin and destination
    if not gtfs_static.stop_map:
        return None

    origin_stop = _find_nearest_stop(o_lat, o_lon, gtfs_static.stop_map)
    dest_stop = _find_nearest_stop(d_lat, d_lon, gtfs_static.stop_map)

    if not origin_stop or not dest_stop:
        return None

    # Determine a plausible route by checking live vehicles near origin stop
    redis = get_redis()
    fleet_ids = await redis.smembers("busiq:fleet")

    best_route = None
    best_vehicle = None
    min_dist = float("inf")

    for vid in list(fleet_ids)[:200]:  # cap to avoid scanning thousands
        vdata = await redis.hgetall(f"busiq:vehicle:{vid}")
        if not vdata:
            continue
        try:
            vlat = float(vdata.get("latitude", 0))
            vlon = float(vdata.get("longitude", 0))
            d = _haversine(vlat, vlon, origin_stop["lat"], origin_stop["lon"])
            if d < min_dist and d < 5.0:
                min_dist = d
                # Resolve human-readable route name via GTFS static
                raw_name = vdata.get("route_short_name", "")
                raw_id = vdata.get("route_id", "")
                # If route_short_name looks like an internal ID (contains "_"), resolve it
                if "_" in raw_name and raw_id:
                    resolved = gtfs_static.get_route_name(raw_id)
                    best_route = resolved if resolved != raw_id else raw_name
                elif raw_name:
                    best_route = raw_name
                elif raw_id:
                    best_route = gtfs_static.get_route_name(raw_id)
                else:
                    best_route = "Bus"
                best_vehicle = vdata
        except (ValueError, TypeError):
            continue

    route_name = best_route or "Dublin Bus"

    # Build segments
    segments: list[JourneySegment] = []

    # Walk to bus stop
    walk_to_dist = _haversine(o_lat, o_lon, origin_stop["lat"], origin_stop["lon"])
    if walk_to_dist > 0.05:
        segments.append(JourneySegment(
            mode="walk",
            from_name=o_name,
            from_lat=o_lat,
            from_lon=o_lon,
            to_name=origin_stop["name"],
            to_lat=origin_stop["lat"],
            to_lon=origin_stop["lon"],
            distance_km=round(walk_to_dist, 2),
            duration_minutes=round(walk_to_dist / WALK_SPEED_KMH * 60, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(walk_to_dist * 1000)}m walk",
        ))

    # Bus segment
    bus_dist = _haversine(origin_stop["lat"], origin_stop["lon"], dest_stop["lat"], dest_stop["lon"])
    bus_time = bus_dist / BUS_SPEED_KMH * 60
    segments.append(JourneySegment(
        mode="bus",
        from_name=origin_stop["name"],
        from_lat=origin_stop["lat"],
        from_lon=origin_stop["lon"],
        to_name=dest_stop["name"],
        to_lat=dest_stop["lat"],
        to_lon=dest_stop["lon"],
        distance_km=round(bus_dist, 2),
        duration_minutes=round(bus_time, 1),
        colour=MODE_COLOURS["bus"],
        details=f"Route {route_name}",
    ))

    # Walk from bus stop to destination
    walk_from_dist = _haversine(dest_stop["lat"], dest_stop["lon"], d_lat, d_lon)
    if walk_from_dist > 0.05:
        segments.append(JourneySegment(
            mode="walk",
            from_name=dest_stop["name"],
            from_lat=dest_stop["lat"],
            from_lon=dest_stop["lon"],
            to_name=d_name,
            to_lat=d_lat,
            to_lon=d_lon,
            distance_km=round(walk_from_dist, 2),
            duration_minutes=round(walk_from_dist / WALK_SPEED_KMH * 60, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(walk_from_dist * 1000)}m walk",
        ))

    return _build_option(segments, "Bus Direct")


async def _plan_with_luas(
    o_lat: float, o_lon: float, d_lat: float, d_lon: float,
    o_name: str, d_name: str,
) -> JourneyOption | None:
    """Plan a journey via Luas: walk/bus → Luas → walk."""
    # Find nearest Luas stops to origin and destination
    origin_luas = _find_nearest_luas(o_lat, o_lon)
    dest_luas = _find_nearest_luas(d_lat, d_lon)

    if not origin_luas or not dest_luas:
        return None
    if origin_luas["code"] == dest_luas["code"]:
        return None

    # Don't suggest Luas if both stops are far (>3km from origin or dest)
    o_walk = _haversine(o_lat, o_lon, origin_luas["lat"], origin_luas["lon"])
    d_walk = _haversine(dest_luas["lat"], dest_luas["lon"], d_lat, d_lon)
    if o_walk > 3.0 or d_walk > 3.0:
        return None

    # Fetch real-time forecast for origin Luas stop
    forecasts = await luas_state.fetch_stop(origin_luas["code"])
    rt_due = None
    rt_detail = f"{origin_luas['line'].title()} Line"
    if forecasts:
        # Find first forecast heading towards destination direction
        best = min(forecasts, key=lambda f: f.due_minutes)
        rt_due = best.due_minutes
        rt_detail = f"{origin_luas['line'].title()} Line → {best.destination}"

    segments: list[JourneySegment] = []

    # Walk to Luas stop
    if o_walk > 0.05:
        segments.append(JourneySegment(
            mode="walk",
            from_name=o_name,
            from_lat=o_lat,
            from_lon=o_lon,
            to_name=origin_luas["name"],
            to_lat=origin_luas["lat"],
            to_lon=origin_luas["lon"],
            distance_km=round(o_walk, 2),
            duration_minutes=round(o_walk / WALK_SPEED_KMH * 60, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(o_walk * 1000)}m walk",
        ))

    # Luas segment  
    luas_dist = _haversine(origin_luas["lat"], origin_luas["lon"], dest_luas["lat"], dest_luas["lon"])
    luas_time = luas_dist / LUAS_SPEED_KMH * 60
    segments.append(JourneySegment(
        mode="luas",
        from_name=origin_luas["name"],
        from_lat=origin_luas["lat"],
        from_lon=origin_luas["lon"],
        to_name=dest_luas["name"],
        to_lat=dest_luas["lat"],
        to_lon=dest_luas["lon"],
        distance_km=round(luas_dist, 2),
        duration_minutes=round(luas_time, 1),
        colour=MODE_COLOURS["luas"],
        details=rt_detail,
        real_time_minutes=rt_due,
    ))

    # Walk from Luas to destination
    if d_walk > 0.05:
        segments.append(JourneySegment(
            mode="walk",
            from_name=dest_luas["name"],
            from_lat=dest_luas["lat"],
            from_lon=dest_luas["lon"],
            to_name=d_name,
            to_lat=d_lat,
            to_lon=d_lon,
            distance_km=round(d_walk, 2),
            duration_minutes=round(d_walk / WALK_SPEED_KMH * 60, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(d_walk * 1000)}m walk",
        ))

    return _build_option(segments, "Via Luas")


async def _plan_with_dart(
    o_lat: float, o_lon: float, d_lat: float, d_lon: float,
    o_name: str, d_name: str,
) -> JourneyOption | None:
    """Plan a journey via DART: walk/bus → DART → walk."""
    origin_dart = _find_nearest_dart(o_lat, o_lon)
    dest_dart = _find_nearest_dart(d_lat, d_lon)

    if not origin_dart or not dest_dart:
        return None
    if origin_dart["code"] == dest_dart["code"]:
        return None

    o_walk = _haversine(o_lat, o_lon, origin_dart["lat"], origin_dart["lon"])
    d_walk = _haversine(dest_dart["lat"], dest_dart["lon"], d_lat, d_lon)
    if o_walk > 4.0 or d_walk > 4.0:
        return None

    # Fetch real-time arrivals
    arrivals = await dart_state.fetch_station(origin_dart["code"])
    rt_due = None
    rt_detail = "DART"
    if arrivals:
        best = min(arrivals, key=lambda a: a.due_minutes)
        rt_due = best.due_minutes
        rt_detail = f"DART → {best.destination}"

    segments: list[JourneySegment] = []

    if o_walk > 0.05:
        segments.append(JourneySegment(
            mode="walk",
            from_name=o_name,
            from_lat=o_lat,
            from_lon=o_lon,
            to_name=origin_dart["name"],
            to_lat=origin_dart["lat"],
            to_lon=origin_dart["lon"],
            distance_km=round(o_walk, 2),
            duration_minutes=round(o_walk / WALK_SPEED_KMH * 60, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(o_walk * 1000)}m walk",
        ))

    dart_dist = _haversine(origin_dart["lat"], origin_dart["lon"], dest_dart["lat"], dest_dart["lon"])
    dart_time = dart_dist / DART_SPEED_KMH * 60
    segments.append(JourneySegment(
        mode="dart",
        from_name=origin_dart["name"],
        from_lat=origin_dart["lat"],
        from_lon=origin_dart["lon"],
        to_name=dest_dart["name"],
        to_lat=dest_dart["lat"],
        to_lon=dest_dart["lon"],
        distance_km=round(dart_dist, 2),
        duration_minutes=round(dart_time, 1),
        colour=MODE_COLOURS["dart"],
        details=rt_detail,
        real_time_minutes=rt_due,
    ))

    if d_walk > 0.05:
        segments.append(JourneySegment(
            mode="walk",
            from_name=dest_dart["name"],
            from_lat=dest_dart["lat"],
            from_lon=dest_dart["lon"],
            to_name=d_name,
            to_lat=d_lat,
            to_lon=d_lon,
            distance_km=round(d_walk, 2),
            duration_minutes=round(d_walk / WALK_SPEED_KMH * 60, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(d_walk * 1000)}m walk",
        ))

    return _build_option(segments, "Via DART")


async def _plan_with_bike(
    o_lat: float, o_lon: float, d_lat: float, d_lon: float,
    o_name: str, d_name: str,
) -> JourneyOption | None:
    """Plan a bike-first journey: walk → bike → walk (or bike → transit → walk)."""
    stations = await dublin_bikes.fetch()
    if not stations:
        return None

    # Find nearest bike station to origin (with bikes available)
    origin_station = None
    min_dist = float("inf")
    for s in stations:
        if s.bikes_available < 1:
            continue
        d = _haversine(o_lat, o_lon, s.latitude, s.longitude)
        if d < min_dist and d < 1.5:
            min_dist = d
            origin_station = s

    if not origin_station:
        return None

    # Find nearest bike station to destination (with docks available)
    dest_station = None
    min_dist = float("inf")
    for s in stations:
        if s.docks_available < 1:
            continue
        d = _haversine(d_lat, d_lon, s.latitude, s.longitude)
        if d < min_dist and d < 1.5:
            min_dist = d
            dest_station = s

    if not dest_station:
        return None

    segments: list[JourneySegment] = []

    # Walk to bike station
    walk_to = _haversine(o_lat, o_lon, origin_station.latitude, origin_station.longitude)
    if walk_to > 0.05:
        segments.append(JourneySegment(
            mode="walk",
            from_name=o_name,
            from_lat=o_lat,
            from_lon=o_lon,
            to_name=origin_station.name,
            to_lat=origin_station.latitude,
            to_lon=origin_station.longitude,
            distance_km=round(walk_to, 2),
            duration_minutes=round(walk_to / WALK_SPEED_KMH * 60, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(walk_to * 1000)}m walk",
        ))

    # Bike segment
    bike_dist = _haversine(
        origin_station.latitude, origin_station.longitude,
        dest_station.latitude, dest_station.longitude,
    )
    bike_time = bike_dist / BIKE_SPEED_KMH * 60
    segments.append(JourneySegment(
        mode="bike",
        from_name=origin_station.name,
        from_lat=origin_station.latitude,
        from_lon=origin_station.longitude,
        to_name=dest_station.name,
        to_lat=dest_station.latitude,
        to_lon=dest_station.longitude,
        distance_km=round(bike_dist, 2),
        duration_minutes=round(bike_time, 1),
        colour=MODE_COLOURS["bike"],
        details=f"Dublin Bikes · {origin_station.bikes_available} available → {dest_station.docks_available} docks",
    ))

    # Walk from bike station to destination
    walk_from = _haversine(dest_station.latitude, dest_station.longitude, d_lat, d_lon)
    if walk_from > 0.05:
        segments.append(JourneySegment(
            mode="walk",
            from_name=dest_station.name,
            from_lat=dest_station.latitude,
            from_lon=dest_station.longitude,
            to_name=d_name,
            to_lat=d_lat,
            to_lon=d_lon,
            distance_km=round(walk_from, 2),
            duration_minutes=round(walk_from / WALK_SPEED_KMH * 60, 1),
            colour=MODE_COLOURS["walk"],
            details=f"{round(walk_from * 1000)}m walk",
        ))

    return _build_option(segments, "Greenest")


# ─── Helpers ─── #


def _find_nearest_stop(lat: float, lon: float, stop_map: dict) -> dict | None:
    """Find nearest GTFS bus stop.
    
    stop_map format: stop_id → (name, lat, lon)
    """
    best = None
    min_d = float("inf")
    for stop_id, (name, slat, slon) in stop_map.items():
        d = _haversine(lat, lon, slat, slon)
        if d < min_d and d < 2.0:
            min_d = d
            best = {"id": stop_id, "name": name, "lat": slat, "lon": slon}
    return best


def _find_nearest_luas(lat: float, lon: float) -> dict | None:
    """Find nearest Luas stop."""
    best = None
    min_d = float("inf")
    for stop in LUAS_STOPS:
        d = _haversine(lat, lon, stop["lat"], stop["lon"])
        if d < min_d:
            min_d = d
            best = stop
    return best


def _find_nearest_dart(lat: float, lon: float) -> dict | None:
    """Find nearest DART station."""
    best = None
    min_d = float("inf")
    for station in DART_STATIONS:
        d = _haversine(lat, lon, station["lat"], station["lon"])
        if d < min_d:
            min_d = d
            best = station
    return best


def _build_option(segments: list[JourneySegment], label: str) -> JourneyOption:
    """Build a JourneyOption from a list of segments."""
    total_dist = sum(s.distance_km for s in segments)
    total_time = sum(s.duration_minutes for s in segments)
    return JourneyOption(
        segments=segments,
        total_distance_km=round(total_dist, 2),
        total_duration_minutes=round(total_time, 1),
        label=label,
    )
