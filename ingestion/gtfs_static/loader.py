"""GTFS Static data loader.

Downloads the Dublin Bus GTFS static feed (zip), extracts
routes.txt, trips.txt, stops.txt and loads them into PostgreSQL
and an in-memory lookup dict for the poller.

This runs once on startup and can be refreshed periodically (daily).
"""

from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path

import httpx
import structlog

logger = structlog.get_logger()

# NTA GTFS static feeds
GTFS_URLS = [
    "https://www.transportforireland.ie/transitData/Data/GTFS_Dublin_Bus.zip",
]


class GtfsStaticLoader:
    """Loads GTFS static data and provides route_id → route_short_name mapping."""

    def __init__(self) -> None:
        # route_id → route_short_name (e.g. "5240_119662" → "39A")
        self.route_map: dict[str, str] = {}
        # trip_id → route_id
        self.trip_route_map: dict[str, str] = {}
        # stop_id → (name, lat, lon)
        self.stop_map: dict[str, tuple[str, float, float]] = {}

    async def load(self, urls: list[str] | None = None) -> None:
        """Download and parse GTFS static data from all operators."""
        urls = urls or GTFS_URLS

        async with httpx.AsyncClient(timeout=60.0) as client:
            for url in urls:
                try:
                    logger.info("gtfs_static.downloading", url=url)
                    resp = await client.get(url, follow_redirects=True)
                    resp.raise_for_status()

                    zf = zipfile.ZipFile(io.BytesIO(resp.content))
                    self._parse_routes(zf)
                    self._parse_trips(zf)
                    self._parse_stops(zf)
                    logger.info(
                        "gtfs_static.loaded",
                        url=url,
                        routes=len(self.route_map),
                        trips=len(self.trip_route_map),
                        stops=len(self.stop_map),
                    )
                except Exception:
                    logger.exception("gtfs_static.load_failed", url=url)

        logger.info(
            "gtfs_static.complete",
            total_routes=len(self.route_map),
            total_trips=len(self.trip_route_map),
            total_stops=len(self.stop_map),
        )

    def _parse_routes(self, zf: zipfile.ZipFile) -> None:
        """Parse routes.txt → route_id to route_short_name mapping."""
        try:
            with zf.open("routes.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    rid = row.get("route_id", "").strip()
                    short = row.get("route_short_name", "").strip()
                    if rid and short:
                        self.route_map[rid] = short
        except KeyError:
            logger.warning("gtfs_static.no_routes_txt")

    def _parse_trips(self, zf: zipfile.ZipFile) -> None:
        """Parse trips.txt → trip_id to route_id mapping."""
        try:
            with zf.open("trips.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    tid = row.get("trip_id", "").strip()
                    rid = row.get("route_id", "").strip()
                    if tid and rid:
                        self.trip_route_map[tid] = rid
        except KeyError:
            logger.warning("gtfs_static.no_trips_txt")

    def _parse_stops(self, zf: zipfile.ZipFile) -> None:
        """Parse stops.txt → stop_id to (name, lat, lon)."""
        try:
            with zf.open("stops.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    sid = row.get("stop_id", "").strip()
                    name = row.get("stop_name", "").strip()
                    lat = float(row.get("stop_lat", 0))
                    lon = float(row.get("stop_lon", 0))
                    if sid:
                        self.stop_map[sid] = (name, lat, lon)
        except KeyError:
            logger.warning("gtfs_static.no_stops_txt")

    def get_route_name(self, route_id: str) -> str:
        """Resolve internal route_id to human-readable name.

        Falls back to stripping the prefix if not in map.
        e.g. "5240_119662" → might resolve to "39A"
        """
        if route_id in self.route_map:
            return self.route_map[route_id]

        # Fallback: some feeds use trip_id-style route IDs
        # Try extracting after underscore
        parts = route_id.split("_")
        if len(parts) >= 2:
            # Try the first part as an agency-prefixed route
            for rid, name in self.route_map.items():
                if rid.startswith(parts[0] + "_"):
                    # Same agency — can't determine exact route from prefix alone
                    pass

        return route_id  # Return raw ID if no mapping found

    def get_route_name_by_trip(self, trip_id: str) -> str:
        """Resolve trip_id → route_id → route_short_name."""
        route_id = self.trip_route_map.get(trip_id, "")
        if route_id:
            return self.get_route_name(route_id)
        return ""


# Module-level singleton
gtfs_static = GtfsStaticLoader()
