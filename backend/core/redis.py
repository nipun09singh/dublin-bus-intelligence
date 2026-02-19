"""Redis connection management — live vehicle state + pub/sub."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis
import structlog

from backend.core.config import settings

logger = structlog.get_logger()

# Module-level Redis client — initialized on startup
_redis: aioredis.Redis | None = None

# Key patterns
VEHICLE_KEY = "busiq:vehicle:{vehicle_id}"
FLEET_KEY = "busiq:fleet"
FLEET_TS_KEY = "busiq:fleet:ts"
CHANNEL = "busiq:live"


async def init_redis() -> aioredis.Redis:
    """Create and test the Redis connection pool.

    Falls back to fakeredis for local development without Docker.
    """
    global _redis
    try:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=50,
        )
        await _redis.ping()
        logger.info("redis.connected", url=settings.REDIS_URL)
    except Exception:
        logger.warning("redis.fallback_to_fakeredis", reason="Redis unavailable, using in-memory store")
        import fakeredis.aioredis as fakeasync
        _redis = fakeasync.FakeRedis(decode_responses=True)
        await _redis.ping()
        logger.info("redis.fakeredis_connected")
    return _redis


async def close_redis() -> None:
    """Close the Redis connection pool."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
        logger.info("redis.closed")


def get_redis() -> aioredis.Redis:
    """Get the active Redis client (FastAPI dependency-friendly)."""
    if _redis is None:
        raise RuntimeError("Redis not initialized — call init_redis() first")
    return _redis


# ─── Vehicle State Operations ─── #


async def set_vehicle(vehicle: dict[str, Any]) -> None:
    """Write a single vehicle position to Redis.

    Stored as a hash at busiq:vehicle:{vehicle_id}.
    Also updates the fleet set and publishes to the live channel.
    """
    r = get_redis()
    vid = vehicle["vehicle_id"]
    key = VEHICLE_KEY.format(vehicle_id=vid)

    # Store as hash — all values as strings
    mapping = {k: json.dumps(v) if isinstance(v, (dict, list)) else str(v) for k, v in vehicle.items()}
    pipe = r.pipeline()
    pipe.hset(key, mapping=mapping)
    pipe.expire(key, 120)  # TTL: 2 minutes — auto-clean stale vehicles
    pipe.sadd(FLEET_KEY, vid)
    await pipe.execute()


async def set_vehicles_batch(vehicles: list[dict[str, Any]]) -> None:
    """Write a batch of vehicle positions to Redis (pipelined).

    This is the hot path — called every 10 seconds with ~500-1100 vehicles.
    Uses pipelining for minimal round trips.
    """
    r = get_redis()
    pipe = r.pipeline()

    vehicle_ids = []
    for v in vehicles:
        vid = v["vehicle_id"]
        vehicle_ids.append(vid)
        key = VEHICLE_KEY.format(vehicle_id=vid)
        mapping = {k: json.dumps(val) if isinstance(val, (dict, list)) else str(val) for k, val in v.items()}
        pipe.hset(key, mapping=mapping)
        pipe.expire(key, 120)

    # Update fleet set
    if vehicle_ids:
        pipe.delete(FLEET_KEY)
        pipe.sadd(FLEET_KEY, *vehicle_ids)

    # Store fleet timestamp
    now = datetime.now(timezone.utc).isoformat()
    pipe.set(FLEET_TS_KEY, now)

    await pipe.execute()

    # Publish snapshot for WebSocket fan-out
    snapshot = json.dumps({"type": "snapshot", "vehicles": vehicles, "timestamp": now})
    await r.publish(CHANNEL, snapshot)


async def get_vehicle(vehicle_id: str) -> dict[str, Any] | None:
    """Read a single vehicle position from Redis."""
    r = get_redis()
    key = VEHICLE_KEY.format(vehicle_id=vehicle_id)
    data = await r.hgetall(key)
    if not data:
        return None
    return _parse_vehicle_hash(data)


async def get_all_vehicles() -> list[dict[str, Any]]:
    """Read all live vehicle positions from Redis."""
    r = get_redis()
    vehicle_ids = await r.smembers(FLEET_KEY)
    if not vehicle_ids:
        return []

    pipe = r.pipeline()
    for vid in vehicle_ids:
        pipe.hgetall(VEHICLE_KEY.format(vehicle_id=vid))
    results = await pipe.execute()

    vehicles = []
    for data in results:
        if data:
            vehicles.append(_parse_vehicle_hash(data))
    return vehicles


async def get_fleet_timestamp() -> str | None:
    """Get the timestamp of the last fleet snapshot."""
    r = get_redis()
    return await r.get(FLEET_TS_KEY)


def _parse_vehicle_hash(data: dict[str, str]) -> dict[str, Any]:
    """Parse Redis hash values back to proper types."""
    return {
        "vehicle_id": data.get("vehicle_id", ""),
        "route_id": data.get("route_id", ""),
        "route_short_name": data.get("route_short_name", ""),
        "trip_id": data.get("trip_id") if data.get("trip_id") != "None" else None,
        "latitude": float(data.get("latitude", 0)),
        "longitude": float(data.get("longitude", 0)),
        "bearing": int(float(data.get("bearing", 0))) if data.get("bearing") and data.get("bearing") != "None" else None,
        "speed_kmh": float(data.get("speed_kmh", 0)) if data.get("speed_kmh") and data.get("speed_kmh") != "None" else None,
        "occupancy_status": data.get("occupancy_status", "UNKNOWN"),
        "delay_seconds": int(float(data.get("delay_seconds", 0))),
        "timestamp": data.get("timestamp", ""),
    }
