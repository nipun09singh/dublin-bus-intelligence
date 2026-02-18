"""GTFS-RT real-time vehicle position poller.

Fetches protobuf feed from NTA every ~10 seconds.
Writes to Redis (live state) and PostgreSQL (historical archive).
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
import structlog
from google.transit import gtfs_realtime_pb2

logger = structlog.get_logger()

# NTA GTFS-RT endpoint
DEFAULT_URL = "https://api.nationaltransport.ie/gtfsr/v2/Vehicles"


class GtfsRealtimePoller:
    """Polls NTA GTFS-RT feed and stores vehicle positions."""

    def __init__(
        self,
        url: str = DEFAULT_URL,
        api_key: str = "",
    ) -> None:
        self.url = url
        self.api_key = api_key
        self._client = httpx.AsyncClient(timeout=15.0)

    async def poll(self) -> None:
        """Fetch the latest vehicle positions from NTA."""
        if not self.api_key:
            logger.warning("gtfs_rt.no_api_key", msg="Skipping poll — no NTA API key configured")
            return

        headers = {"x-api-key": self.api_key}
        response = await self._client.get(self.url, headers=headers)
        response.raise_for_status()

        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(response.content)

        vehicles = []
        for entity in feed.entity:
            if not entity.HasField("vehicle"):
                continue

            vp = entity.vehicle
            pos = vp.position

            vehicle_data = {
                "vehicle_id": vp.vehicle.id,
                "route_id": vp.trip.route_id if vp.HasField("trip") else "",
                "trip_id": vp.trip.trip_id if vp.HasField("trip") else None,
                "latitude": pos.latitude,
                "longitude": pos.longitude,
                "bearing": int(pos.bearing) if pos.bearing else None,
                "speed_kmh": round(pos.speed * 3.6, 1) if pos.speed else None,
                "occupancy_status": self._parse_occupancy(vp),
                "delay_seconds": (
                    vp.trip.schedule_relationship if vp.HasField("trip") else 0
                ),
                "timestamp": datetime.fromtimestamp(
                    vp.timestamp, tz=timezone.utc
                ).isoformat(),
            }
            vehicles.append(vehicle_data)

        logger.info(
            "gtfs_rt.polled",
            vehicle_count=len(vehicles),
            feed_timestamp=datetime.fromtimestamp(
                feed.header.timestamp, tz=timezone.utc
            ).isoformat(),
        )

        # TODO: Write to Redis (live state)
        # TODO: Write to PostgreSQL (historical archive)

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
