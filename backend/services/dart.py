"""DART / Commuter Rail real-time integration — Irish Rail API.

Fetches live train information from the Irish Rail Realtime API.
Used in multimodal journey planning (Smart Cities pillar).

API: http://api.irishrail.ie/realtime/
Endpoint: http://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML_WithNumMins?StationCode={code}&NumMins=30
No API key needed (public).
"""

from __future__ import annotations

import asyncio
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

import httpx
import structlog

logger = structlog.get_logger()

IRISH_RAIL_BASE = "http://api.irishrail.ie/realtime/realtime.asmx"
CACHE_TTL = 30  # seconds
NS = "{http://api.irishrail.ie/realtime/}"  # XML namespace

# Key DART stations in the Dublin commuter area
DART_STATIONS: list[dict] = [
    {"code": "BRAY", "name": "Bray", "lat": 53.2028, "lon": -6.0986, "type": "dart"},
    {"code": "DLERY", "name": "Dún Laoghaire", "lat": 53.2948, "lon": -6.1350, "type": "dart"},
    {"code": "SHILL", "name": "Shankill", "lat": 53.2330, "lon": -6.1155, "type": "dart"},
    {"code": "KILNY", "name": "Killiney", "lat": 53.2530, "lon": -6.1130, "type": "dart"},
    {"code": "DALKY", "name": "Dalkey", "lat": 53.2760, "lon": -6.1005, "type": "dart"},
    {"code": "GLGRY", "name": "Glenageary", "lat": 53.2820, "lon": -6.1200, "type": "dart"},
    {"code": "SDMNT", "name": "Sandymount", "lat": 53.3274, "lon": -6.2195, "type": "dart"},
    {"code": "LNSTN", "name": "Lansdowne Road", "lat": 53.3314, "lon": -6.2270, "type": "dart"},
    {"code": "GDSTN", "name": "Grand Canal Dock", "lat": 53.3388, "lon": -6.2380, "type": "dart"},
    {"code": "PERSE", "name": "Pearse", "lat": 53.3432, "lon": -6.2480, "type": "dart"},
    {"code": "TARA", "name": "Tara Street", "lat": 53.3468, "lon": -6.2538, "type": "dart"},
    {"code": "CNLLY", "name": "Connolly", "lat": 53.3522, "lon": -6.2499, "type": "dart"},
    {"code": "CLGRN", "name": "Clontarf Road", "lat": 53.3610, "lon": -6.2330, "type": "dart"},
    {"code": "KLLST", "name": "Killester", "lat": 53.3650, "lon": -6.2130, "type": "dart"},
    {"code": "HRMST", "name": "Harmonstown", "lat": 53.3660, "lon": -6.2010, "type": "dart"},
    {"code": "RAHNY", "name": "Raheny", "lat": 53.3680, "lon": -6.1830, "type": "dart"},
    {"code": "KLBRK", "name": "Kilbarrack", "lat": 53.3700, "lon": -6.1660, "type": "dart"},
    {"code": "HWTHJ", "name": "Howth Junction", "lat": 53.3730, "lon": -6.1490, "type": "dart"},
    {"code": "BFCLR", "name": "Bayside", "lat": 53.3785, "lon": -6.1380, "type": "dart"},
    {"code": "SUTTN", "name": "Sutton", "lat": 53.3890, "lon": -6.1050, "type": "dart"},
    {"code": "HOWTH", "name": "Howth", "lat": 53.3882, "lon": -6.0655, "type": "dart"},
    {"code": "MLHDE", "name": "Malahide", "lat": 53.4505, "lon": -6.1540, "type": "dart"},
    {"code": "HSTON", "name": "Heuston", "lat": 53.3465, "lon": -6.2929, "type": "commuter"},
    {"code": "BBRGE", "name": "Broombridge", "lat": 53.3720, "lon": -6.2975, "type": "commuter"},
    {"code": "DMDRT", "name": "Drumcondra", "lat": 53.3644, "lon": -6.2592, "type": "commuter"},
]


@dataclass
class DartArrival:
    """A single DART/commuter rail arrival."""

    station_code: str
    station_name: str
    origin: str
    destination: str
    direction: str
    due_minutes: int
    status: str       # "On Time", "Late", "Expected HH:MM"
    train_type: str   # "DART", "Commuter", etc.
    late_minutes: int


@dataclass
class DartState:
    """In-memory state for DART forecasts."""

    arrivals: dict[str, list[DartArrival]] = field(default_factory=dict)  # code → arrivals
    last_fetched: dict[str, float] = field(default_factory=dict)
    _client: httpx.AsyncClient | None = None
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def fetch_station(self, station_code: str, num_mins: int = 30) -> list[DartArrival]:
        """Fetch live arrivals for a single station."""
        now = time.time()
        cached = self.last_fetched.get(station_code, 0)
        if now - cached < CACHE_TTL and station_code in self.arrivals:
            return self.arrivals[station_code]

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{IRISH_RAIL_BASE}/getStationDataByCodeXML_WithNumMins",
                params={"StationCode": station_code, "NumMins": num_mins},
            )
            resp.raise_for_status()
            arrivals = self._parse_xml(resp.text, station_code)
            self.arrivals[station_code] = arrivals
            self.last_fetched[station_code] = now
            return arrivals
        except Exception as e:
            logger.warning("dart.fetch_error", station=station_code, error=str(e))
            return self.arrivals.get(station_code, [])

    def _parse_xml(self, xml_text: str, station_code: str) -> list[DartArrival]:
        """Parse Irish Rail station XML."""
        arrivals = []
        try:
            root = ET.fromstring(xml_text)
            station_info = next((s for s in DART_STATIONS if s["code"] == station_code), None)
            station_name = station_info["name"] if station_info else station_code

            for train in root.findall(f"{NS}objStationData"):
                origin = self._tag_text(train, "Origin")
                destination = self._tag_text(train, "Destination")
                direction = self._tag_text(train, "Direction")
                due_str = self._tag_text(train, "Duein")
                status = self._tag_text(train, "Status")
                train_type = self._tag_text(train, "Traintype")
                late_str = self._tag_text(train, "Late")

                try:
                    due_min = int(due_str) if due_str else 0
                except ValueError:
                    due_min = 0
                try:
                    late_min = int(late_str) if late_str else 0
                except ValueError:
                    late_min = 0

                arrivals.append(
                    DartArrival(
                        station_code=station_code,
                        station_name=station_name,
                        origin=origin,
                        destination=destination,
                        direction=direction,
                        due_minutes=due_min,
                        status=status,
                        train_type=train_type,
                        late_minutes=late_min,
                    )
                )
        except ET.ParseError as e:
            logger.warning("dart.xml_parse_error", station=station_code, error=str(e))
        arrivals.sort(key=lambda a: a.due_minutes)
        return arrivals

    def _tag_text(self, elem: ET.Element, tag: str) -> str:
        """Extract text from a namespaced XML tag."""
        child = elem.find(f"{NS}{tag}")
        return child.text.strip() if child is not None and child.text else ""

    async def fetch_nearby(self, lat: float, lon: float, radius_km: float = 2.0) -> list[dict]:
        """Fetch arrivals for stations near a point."""
        import math

        nearby = []
        for station in DART_STATIONS:
            dlat = math.radians(station["lat"] - lat)
            dlon = math.radians(station["lon"] - lon)
            a = (
                math.sin(dlat / 2) ** 2
                + math.cos(math.radians(lat))
                * math.cos(math.radians(station["lat"]))
                * math.sin(dlon / 2) ** 2
            )
            d = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            if d <= radius_km:
                arrivals = await self.fetch_station(station["code"])
                nearby.append({
                    "station": station,
                    "distance_km": round(d, 3),
                    "arrivals": arrivals,
                })
        nearby.sort(key=lambda x: x["distance_km"])
        return nearby

    def get_all_stations(self) -> list[dict]:
        """Return all DART stations with static info."""
        return DART_STATIONS

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Module singleton
dart_state = DartState()
