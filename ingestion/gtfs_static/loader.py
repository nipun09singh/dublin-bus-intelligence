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

# NTA GTFS static feeds — combined feed covers all operators (Dublin Bus, Bus Éireann, Go-Ahead)
GTFS_URLS = [
    "https://www.transportforireland.ie/transitData/Data/GTFS_Realtime.zip",
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
        # shape_id → list of (lat, lon, sequence)
        self.shape_map: dict[str, list[tuple[float, float]]] = {}
        # trip_id → shape_id
        self.trip_shape_map: dict[str, str] = {}
        # route_id → set of shape_ids (via trips)
        self.route_shapes: dict[str, set[str]] = {}
        # route_id → set of stop_ids served by that route
        self.route_stops: dict[str, set[str]] = {}

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
                    self._parse_stop_times(zf)
                    self._parse_shapes(zf)
                    self._build_route_shapes()
                    logger.info(
                        "gtfs_static.loaded",
                        url=url,
                        routes=len(self.route_map),
                        trips=len(self.trip_route_map),
                        stops=len(self.stop_map),
                        shapes=len(self.shape_map),
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
        """Parse trips.txt → trip_id to route_id + shape_id mapping."""
        try:
            with zf.open("trips.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    tid = row.get("trip_id", "").strip()
                    rid = row.get("route_id", "").strip()
                    shape_id = row.get("shape_id", "").strip()
                    if tid and rid:
                        self.trip_route_map[tid] = rid
                    if tid and shape_id:
                        self.trip_shape_map[tid] = shape_id
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

    def _parse_stop_times(self, zf: zipfile.ZipFile) -> None:
        """Parse stop_times.txt → build route_id to set[stop_id] mapping.

        Uses trip_route_map (from trips.txt) to map trip → route,
        then collects all stop_ids served by each route.
        """
        try:
            with zf.open("stop_times.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    tid = row.get("trip_id", "").strip()
                    sid = row.get("stop_id", "").strip()
                    if tid and sid:
                        rid = self.trip_route_map.get(tid, "")
                        if rid:
                            self.route_stops.setdefault(rid, set()).add(sid)
            logger.info(
                "gtfs_static.route_stops_built",
                routes_with_stops=len(self.route_stops),
            )
        except KeyError:
            logger.warning("gtfs_static.no_stop_times_txt")

    def _parse_shapes(self, zf: zipfile.ZipFile) -> None:
        """Parse shapes.txt → shape_id to ordered list of (lat, lon)."""
        try:
            with zf.open("shapes.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                raw: dict[str, list[tuple[int, float, float]]] = {}
                for row in reader:
                    shape_id = row.get("shape_id", "").strip()
                    lat = float(row.get("shape_pt_lat", 0))
                    lon = float(row.get("shape_pt_lon", 0))
                    seq = int(row.get("shape_pt_sequence", 0))
                    if shape_id:
                        raw.setdefault(shape_id, []).append((seq, lat, lon))
                # Sort by sequence and store as (lat, lon) only
                for shape_id, pts in raw.items():
                    pts.sort(key=lambda x: x[0])
                    self.shape_map[shape_id] = [(lat, lon) for _, lat, lon in pts]
                logger.info("gtfs_static.shapes_parsed", count=len(self.shape_map))
        except KeyError:
            logger.warning("gtfs_static.no_shapes_txt")

    def _build_route_shapes(self) -> None:
        """Build route_id → shape_ids mapping via trips.txt (trip → shape, trip → route)."""
        # First, build trip_id → shape_id from trips.txt (already parsed)
        # We need to re-read trip_shape_map — trips.txt has shape_id column
        # But we already parsed trips — let's just use what we have
        # route_shapes is populated from trip_route_map + trip_shape_map
        for trip_id, route_id in self.trip_route_map.items():
            shape_id = self.trip_shape_map.get(trip_id)
            if shape_id:
                self.route_shapes.setdefault(route_id, set()).add(shape_id)
        logger.info(
            "gtfs_static.route_shapes_built",
            routes_with_shapes=len(self.route_shapes),
        )

    def get_route_name(self, route_id: str) -> str:
        """Resolve internal route_id to human-readable name.

        Falls back to stripping the prefix if not in map.
        e.g. "5240_119662" → might resolve to "39A"
        """
        if route_id in self.route_map:
            return self.route_map[route_id]

        # Fallback: try resolving via trip_route_map (trip may reference
        # a different version of the route_id that IS in route_map)
        for tid, rid in self.trip_route_map.items():
            if rid == route_id and rid in self.route_map:
                return self.route_map[rid]

        return route_id  # Return raw ID if no mapping found

    def get_route_name_by_trip(self, trip_id: str) -> str:
        """Resolve trip_id → route_id → route_short_name."""
        route_id = self.trip_route_map.get(trip_id, "")
        if route_id:
            return self.get_route_name(route_id)
        return ""

    def get_shapes_geojson(self, route_id: str | None = None) -> dict:
        """Export route shapes as GeoJSON FeatureCollection.

        If route_id specified, return only that route's shapes.
        Otherwise, return one representative shape per route (first shape_id).
        """
        features = []

        if route_id:
            # Single route — return all its shapes  
            shape_ids = self.route_shapes.get(route_id, set())
            for shape_id in shape_ids:
                coords = self.shape_map.get(shape_id, [])
                if len(coords) < 2:
                    continue
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[lon, lat] for lat, lon in coords],
                    },
                    "properties": {
                        "route_id": route_id,
                        "route_short_name": self.get_route_name(route_id),
                        "shape_id": shape_id,
                    },
                })
        else:
            # All routes — one representative shape per route
            for rid, shape_ids in self.route_shapes.items():
                if not shape_ids:
                    continue
                # Pick the shape with the most points (most complete)
                best_shape = max(shape_ids, key=lambda s: len(self.shape_map.get(s, [])))
                coords = self.shape_map.get(best_shape, [])
                if len(coords) < 2:
                    continue
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[lon, lat] for lat, lon in coords],
                    },
                    "properties": {
                        "route_id": rid,
                        "route_short_name": self.get_route_name(rid),
                        "shape_id": best_shape,
                    },
                })

        return {
            "type": "FeatureCollection",
            "features": features,
        }

    def get_stops_geojson(self) -> dict:
        """Export all stops as GeoJSON FeatureCollection."""
        features = []
        for stop_id, (name, lat, lon) in self.stop_map.items():
            if lat == 0 and lon == 0:
                continue
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat],
                },
                "properties": {
                    "stop_id": stop_id,
                    "stop_name": name,
                },
            })
        return {
            "type": "FeatureCollection",
            "features": features,
        }

    def get_all_routes_info(self) -> list[dict]:
        """Return list of all routes with metadata."""
        routes = []
        for route_id, short_name in self.route_map.items():
            routes.append({
                "route_id": route_id,
                "route_short_name": short_name,
                "has_shapes": route_id in self.route_shapes,
                "shape_count": len(self.route_shapes.get(route_id, set())),
            })
        routes.sort(key=lambda r: r["route_short_name"])
        return routes


# Module-level singleton
gtfs_static = GtfsStaticLoader()
