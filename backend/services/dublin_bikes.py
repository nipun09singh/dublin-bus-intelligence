"""Dublin Bikes integration — CityBik.es Open API.

Fetches real-time station availability (bikes + docks) for Dublin's bike-share.
Used in multimodal journey planning (Smart Cities pillar).

API: https://api.citybik.es/v2/networks/dublinbikes
No API key required (fully public).
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

import httpx
import structlog

logger = structlog.get_logger()

# CityBik.es public API — dublin network
CITYBIKES_API_URL = "https://api.citybik.es/v2/networks/dublinbikes"

POLL_INTERVAL = 60  # seconds (station data doesn't change rapidly)
CACHE_TTL = 120  # seconds


@dataclass
class BikeStation:
    """A single Dublin Bikes station."""

    station_id: int
    name: str
    address: str
    latitude: float
    longitude: float
    bikes_available: int
    docks_available: int
    total_capacity: int
    status: str  # "OPEN" or "CLOSED"
    last_update: int  # unix timestamp in ms


@dataclass
class DublinBikesState:
    """In-memory cache of all Dublin Bikes stations."""

    stations: list[BikeStation] = field(default_factory=list)
    last_fetched: float = 0.0
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    _client: httpx.AsyncClient | None = None

    @property
    def is_stale(self) -> bool:
        return time.time() - self.last_fetched > CACHE_TTL

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def fetch(self) -> list[BikeStation]:
        """Fetch latest station data from CityBik.es API."""
        async with self._lock:
            if not self.is_stale and self.stations:
                return self.stations

            client = await self._get_client()
            try:
                resp = await client.get(CITYBIKES_API_URL)
                resp.raise_for_status()
                raw = resp.json()

                stations_raw = raw.get("network", {}).get("stations", [])
                self.stations = [
                    BikeStation(
                        station_id=i,
                        name=s.get("name", ""),
                        address=s.get("name", ""),
                        latitude=s.get("latitude", 0),
                        longitude=s.get("longitude", 0),
                        bikes_available=s.get("free_bikes", 0),
                        docks_available=s.get("empty_slots", 0),
                        total_capacity=s.get("free_bikes", 0) + s.get("empty_slots", 0),
                        status="OPEN" if s.get("free_bikes", 0) + s.get("empty_slots", 0) > 0 else "CLOSED",
                        last_update=int(time.time() * 1000),
                    )
                    for i, s in enumerate(stations_raw)
                    if "latitude" in s and "longitude" in s
                ]
                self.last_fetched = time.time()
                logger.info(
                    "dublin_bikes.fetched",
                    stations=len(self.stations),
                    open=sum(1 for s in self.stations if s.status == "OPEN"),
                )
            except httpx.HTTPStatusError as e:
                logger.warning("dublin_bikes.http_error", status=e.response.status_code)
            except Exception as e:
                logger.warning("dublin_bikes.fetch_error", error=str(e))

            return self.stations

    def get_nearby(self, lat: float, lon: float, radius_km: float = 0.5) -> list[BikeStation]:
        """Return stations within radius_km of a point (haversine)."""
        import math

        results = []
        for s in self.stations:
            dlat = math.radians(s.latitude - lat)
            dlon = math.radians(s.longitude - lon)
            a = (
                math.sin(dlat / 2) ** 2
                + math.cos(math.radians(lat))
                * math.cos(math.radians(s.latitude))
                * math.sin(dlon / 2) ** 2
            )
            d = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            if d <= radius_km and s.status == "OPEN":
                results.append(s)
        results.sort(key=lambda s: s.bikes_available, reverse=True)
        return results

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Module singleton
dublin_bikes = DublinBikesState()
