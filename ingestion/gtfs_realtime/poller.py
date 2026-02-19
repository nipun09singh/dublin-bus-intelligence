"""GTFS-RT real-time vehicle position poller.

Fetches protobuf feeds from NTA every ~10 seconds:
  - VehiclePositions: lat/lon, speed, route, timestamp
  - TripUpdates: arrival/departure delays per stop

Merges delay data into vehicle positions, resolves human-readable
route names via GTFS static, then writes to Redis (live) and
optionally PostgreSQL (historical archive).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
import redis.asyncio as aioredis
import structlog
from google.transit import gtfs_realtime_pb2

from ingestion.gtfs_static.loader import gtfs_static

logger = structlog.get_logger()

VEHICLES_URL = "https://api.nationaltransport.ie/gtfsr/v2/Vehicles"
TRIP_UPDATES_URL = "https://api.nationaltransport.ie/gtfsr/v2/TripUpdates"


class GtfsRealtimePoller:
    """Polls NTA GTFS-RT feeds and writes vehicle state to Redis."""

    def __init__(
        self,
        api_key: str = "",
        redis_client: aioredis.Redis | None = None,
    ) -> None:
        self.api_key = api_key
        self.redis = redis_client
        self._client = httpx.AsyncClient(timeout=15.0)

    async def poll(self) -> None:
        """Fetch vehicle positions + trip updates, merge, and store."""
        if not self.api_key:
            logger.warning("gtfs_rt.no_api_key", msg="Skipping poll — no NTA API key")
            return

        headers = {"x-api-key": self.api_key}

        # Fetch both feeds concurrently
        try:
            vp_resp, tu_resp = await self._fetch_feeds(headers)
        except Exception:
            logger.exception("gtfs_rt.fetch_failed")
            raise  # Re-raise so caller's backoff logic works

        # Parse TripUpdates → {trip_id: max_delay_seconds}
        delay_map = self._parse_trip_updates(tu_resp)

        # Parse VehiclePositions and enrich with delays + route names
        vehicles = self._parse_vehicle_positions(vp_resp, delay_map)

        logger.info(
            "gtfs_rt.polled",
            vehicle_count=len(vehicles),
            trips_with_delays=len(delay_map),
        )

        # Write to Redis
        if self.redis and vehicles:
            await self._write_to_redis(vehicles)

    async def _fetch_feeds(
        self, headers: dict[str, str]
    ) -> tuple[bytes, bytes]:
        """Fetch VehiclePositions and TripUpdates concurrently."""
        import asyncio

        vp_coro = self._client.get(VEHICLES_URL, headers=headers)
        tu_coro = self._client.get(TRIP_UPDATES_URL, headers=headers)

        vp_resp, tu_resp = await asyncio.gather(vp_coro, tu_coro, return_exceptions=True)

        # Handle VehiclePositions (required)
        if isinstance(vp_resp, Exception):
            raise vp_resp
        if vp_resp.status_code == 429:
            logger.warning("gtfs_rt.rate_limited", feed="vehicles")
            raise Exception("Rate limited by NTA API")
        vp_resp.raise_for_status()

        # Handle TripUpdates (optional — graceful fallback)
        tu_bytes = b""
        if isinstance(tu_resp, Exception):
            logger.warning("gtfs_rt.trip_updates_failed", error=str(tu_resp))
        elif tu_resp.status_code == 429:
            logger.warning("gtfs_rt.rate_limited", feed="trip_updates")
        elif tu_resp.status_code == 200:
            tu_bytes = tu_resp.content
        else:
            logger.warning("gtfs_rt.trip_updates_error", status=tu_resp.status_code)

        return vp_resp.content, tu_bytes

    def _parse_trip_updates(self, data: bytes) -> dict[str, int]:
        """Parse TripUpdates feed → {trip_id: max_delay_seconds}."""
        if not data:
            return {}

        delay_map: dict[str, int] = {}
        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(data)

        for entity in feed.entity:
            if not entity.HasField("trip_update"):
                continue
            tu = entity.trip_update
            trip_id = tu.trip.trip_id if tu.HasField("trip") else ""
            if not trip_id:
                continue

            # Get the maximum delay across all stop time updates
            max_delay = 0
            for stu in tu.stop_time_update:
                if stu.HasField("arrival"):
                    max_delay = max(max_delay, abs(stu.arrival.delay))
                if stu.HasField("departure"):
                    max_delay = max(max_delay, abs(stu.departure.delay))

            if max_delay > 0:
                delay_map[trip_id] = max_delay

        return delay_map

    def _parse_vehicle_positions(
        self, data: bytes, delay_map: dict[str, int]
    ) -> list[dict[str, Any]]:
        """Parse VehiclePositions feed, enrich with delays + route names."""
        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(data)

        vehicles: list[dict[str, Any]] = []
        for entity in feed.entity:
            if not entity.HasField("vehicle"):
                continue

            vp = entity.vehicle
            pos = vp.position
            trip_id = vp.trip.trip_id if vp.HasField("trip") else None
            route_id = vp.trip.route_id if vp.HasField("trip") else ""

            # Resolve human-readable route name
            route_short_name = ""
            if trip_id:
                route_short_name = gtfs_static.get_route_name_by_trip(trip_id)
            if not route_short_name and route_id:
                route_short_name = gtfs_static.get_route_name(route_id)

            # Get delay from TripUpdates (or 0)
            delay = delay_map.get(trip_id, 0) if trip_id else 0

            vehicle_data: dict[str, Any] = {
                "vehicle_id": vp.vehicle.id,
                "route_id": route_id,
                "route_short_name": route_short_name or route_id,
                "trip_id": trip_id,
                "latitude": round(pos.latitude, 6),
                "longitude": round(pos.longitude, 6),
                "bearing": int(pos.bearing) if pos.bearing else None,
                "speed_kmh": round(pos.speed * 3.6, 1) if pos.speed else None,
                "occupancy_status": self._parse_occupancy(vp),
                "delay_seconds": delay,
                "timestamp": datetime.fromtimestamp(
                    vp.timestamp, tz=timezone.utc
                ).isoformat(),
            }
            vehicles.append(vehicle_data)

        return vehicles

    async def _write_to_redis(self, vehicles: list[dict[str, Any]]) -> None:
        """Write vehicle batch to Redis with pipelining + pub/sub."""
        import json

        pipe = self.redis.pipeline()
        vehicle_ids = []

        for v in vehicles:
            vid = v["vehicle_id"]
            vehicle_ids.append(vid)
            key = f"busiq:vehicle:{vid}"
            mapping = {
                k: json.dumps(val) if isinstance(val, (dict, list)) else str(val)
                for k, val in v.items()
            }
            pipe.hset(key, mapping=mapping)
            pipe.expire(key, 120)

        # Update fleet set
        if vehicle_ids:
            pipe.delete("busiq:fleet")
            pipe.sadd("busiq:fleet", *vehicle_ids)

        # Fleet timestamp
        now = datetime.now(timezone.utc).isoformat()
        pipe.set("busiq:fleet:ts", now)

        await pipe.execute()

        # Publish for WebSocket fan-out
        snapshot = json.dumps({
            "type": "snapshot",
            "vehicles": vehicles,
            "timestamp": now,
        })
        await self.redis.publish("busiq:live", snapshot)

        logger.debug("gtfs_rt.redis_written", count=len(vehicles))

    @staticmethod
    def _parse_occupancy(vp) -> str:
        """Parse GTFS-RT occupancy status to string."""
        occupancy_map = {
            0: "EMPTY",
            1: "MANY_SEATS_AVAILABLE",
            2: "FEW_SEATS_AVAILABLE",
            3: "STANDING_ROOM_ONLY",
            4: "CRUSHED_STANDING_ROOM_ONLY",
            5: "FULL",
            6: "NOT_ACCEPTING_PASSENGERS",
        }
        if vp.HasField("occupancy_status"):
            return occupancy_map.get(vp.occupancy_status, "UNKNOWN")
        return "UNKNOWN"

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()

        await self._client.aclose()
