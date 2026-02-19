"""ETA Prediction Service — heuristic-based arrival time estimator.

Phase 3, v1: Uses current live bus positions, speed, delay, and remaining
distance to estimate arrival at stops. No ML yet — pure geometry + heuristics.

When we have enough historical data, this gets replaced with LightGBM (v2)
and eventually a Temporal Fusion Transformer (v3).

The heuristic approach:
  1. Find all live buses on the requested route
  2. For each bus, compute distance to the target stop (haversine)
  3. Estimate time = distance / current_speed (or fallback avg speed)
  4. Adjust by current delay trend
  5. Return sorted list of upcoming arrivals with confidence
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import structlog

from backend.core.redis import get_all_vehicles
from ingestion.gtfs_static.loader import gtfs_static

logger = structlog.get_logger()

# Dublin Bus average speed in the city (km/h) — used when live speed unavailable
DEFAULT_SPEED_KMH = 15.0
# Maximum distance (km) to consider a bus "approaching" a stop
MAX_APPROACH_DISTANCE_KM = 15.0


@dataclass
class ETAPrediction:
    """A single predicted arrival."""
    vehicle_id: str
    route_id: str
    route_short_name: str
    predicted_arrival: datetime
    eta_minutes: float
    distance_km: float
    confidence: float
    current_delay_seconds: int
    speed_kmh: float
    approach_bearing: float | None = None


@dataclass
class StopPredictionResult:
    """All predicted arrivals at a stop."""
    stop_id: str
    stop_name: str
    latitude: float
    longitude: float
    predictions: list[ETAPrediction] = field(default_factory=list)
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute haversine distance between two points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute bearing from point 1 to point 2 in degrees."""
    dlon = math.radians(lon2 - lon1)
    lat1r, lat2r = math.radians(lat1), math.radians(lat2)
    x = math.sin(dlon) * math.cos(lat2r)
    y = math.cos(lat1r) * math.sin(lat2r) - math.sin(lat1r) * math.cos(lat2r) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


async def predict_stop_arrivals(
    stop_id: str,
    route_id: str | None = None,
) -> StopPredictionResult:
    """Predict upcoming bus arrivals at a stop.

    Args:
        stop_id: The GTFS stop ID.
        route_id: Optional — filter to a specific route.

    Returns:
        StopPredictionResult with sorted predictions (nearest first).
    """
    # Resolve stop position
    stop_data = gtfs_static.stop_map.get(stop_id)
    if not stop_data:
        return StopPredictionResult(
            stop_id=stop_id,
            stop_name="Unknown",
            latitude=0,
            longitude=0,
        )

    stop_name, stop_lat, stop_lon = stop_data

    # Get all live vehicles
    vehicles = await get_all_vehicles()
    if not vehicles:
        return StopPredictionResult(
            stop_id=stop_id,
            stop_name=stop_name,
            latitude=stop_lat,
            longitude=stop_lon,
        )

    now = datetime.now(timezone.utc)
    predictions: list[ETAPrediction] = []

    for v in vehicles:
        # Filter by route if specified
        if route_id and v["route_id"] != route_id:
            continue

        vlat = v["latitude"]
        vlon = v["longitude"]
        dist_km = _haversine_km(vlat, vlon, stop_lat, stop_lon)

        # Skip buses too far away
        if dist_km > MAX_APPROACH_DISTANCE_KM:
            continue

        # Use live speed or fallback
        speed = v.get("speed_kmh") or DEFAULT_SPEED_KMH
        if speed < 2.0:
            speed = DEFAULT_SPEED_KMH  # Stationary bus — use average

        # ETA = distance / speed, adjusted for delay
        eta_hours = dist_km / speed
        eta_minutes = eta_hours * 60

        # Delay adjustment: if bus is already delayed, add a portion
        current_delay = v.get("delay_seconds", 0)
        # If delayed, add 30% of current delay as pessimistic buffer
        if current_delay > 60:
            eta_minutes += (current_delay * 0.3) / 60

        # Confidence model (heuristic):
        # - Close distance + good speed data = high confidence
        # - Far away + no speed = low confidence
        data_age_s = (now - datetime.fromisoformat(v["timestamp"].replace("Z", "+00:00"))).total_seconds()
        confidence = 1.0
        # Distance penalty: confidence drops with distance
        confidence *= max(0.3, 1 - (dist_km / MAX_APPROACH_DISTANCE_KM))
        # Speed data bonus
        if v.get("speed_kmh") is not None:
            confidence *= 1.0
        else:
            confidence *= 0.6
        # Data freshness penalty
        if data_age_s > 60:
            confidence *= max(0.4, 1 - (data_age_s / 300))
        confidence = round(min(1.0, max(0.1, confidence)), 2)

        predicted_arrival = now + timedelta(minutes=eta_minutes)

        # Compute approach bearing (bus → stop)
        approach = _bearing(vlat, vlon, stop_lat, stop_lon)

        predictions.append(
            ETAPrediction(
                vehicle_id=v["vehicle_id"],
                route_id=v["route_id"],
                route_short_name=v.get("route_short_name", ""),
                predicted_arrival=predicted_arrival,
                eta_minutes=round(eta_minutes, 1),
                distance_km=round(dist_km, 2),
                confidence=confidence,
                current_delay_seconds=current_delay,
                speed_kmh=round(speed, 1),
                approach_bearing=round(approach, 1),
            )
        )

    # Sort by ETA (nearest first)
    predictions.sort(key=lambda p: p.eta_minutes)

    # Limit to top 10 nearest
    predictions = predictions[:10]

    return StopPredictionResult(
        stop_id=stop_id,
        stop_name=stop_name,
        latitude=stop_lat,
        longitude=stop_lon,
        predictions=predictions,
    )
