"""Luas real-time integration — luasforecasting.gov.ie XML API.

Fetches live tram forecasts for all Luas stops (Red + Green lines).
Used in multimodal journey planning (Smart Cities pillar).

API: http://luasforecasting.gov.ie/analysis/view.aspx
Endpoint: https://luasforecasting.gov.ie/xml/get.ashx?action=forecast&stop={code}&encrypt=false
Rate limit: Generous (public API, no key needed)
"""

from __future__ import annotations

import asyncio
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

import httpx
import structlog

logger = structlog.get_logger()

LUAS_FORECAST_URL = "https://luasforecasting.gov.ie/xml/get.ashx"
CACHE_TTL = 30  # seconds — Luas data changes rapidly

# All Luas stops with their codes, names, lat/lon, and line (red/green)
LUAS_STOPS: list[dict] = [
    # ─── Green Line ───
    {"code": "BRI", "name": "Bride's Glen", "lat": 53.2420, "lon": -6.1430, "line": "green"},
    {"code": "CCK", "name": "Cherrywood", "lat": 53.2450, "lon": -6.1450, "line": "green"},
    {"code": "LAU", "name": "Laughanstown", "lat": 53.2520, "lon": -6.1540, "line": "green"},
    {"code": "CAR", "name": "Carrickmines", "lat": 53.2570, "lon": -6.1620, "line": "green"},
    {"code": "BRE", "name": "Brennanstown", "lat": 53.2600, "lon": -6.1650, "line": "green"},
    {"code": "BAL", "name": "Balally", "lat": 53.2690, "lon": -6.1730, "line": "green"},
    {"code": "KIL", "name": "Kilmacud", "lat": 53.2780, "lon": -6.1850, "line": "green"},
    {"code": "STI", "name": "Stillorgan", "lat": 53.2830, "lon": -6.2090, "line": "green"},
    {"code": "SAN", "name": "Sandyford", "lat": 53.2770, "lon": -6.2040, "line": "green"},
    {"code": "CPK", "name": "Central Park", "lat": 53.2710, "lon": -6.2030, "line": "green"},
    {"code": "GLE", "name": "Glencairn", "lat": 53.2800, "lon": -6.2100, "line": "green"},
    {"code": "GAL", "name": "The Gallops", "lat": 53.2840, "lon": -6.2150, "line": "green"},
    {"code": "LEO", "name": "Leopardstown Valley", "lat": 53.2860, "lon": -6.2200, "line": "green"},
    {"code": "BEE", "name": "Beechwood", "lat": 53.3180, "lon": -6.2530, "line": "green"},
    {"code": "RAN", "name": "Ranelagh", "lat": 53.3260, "lon": -6.2630, "line": "green"},
    {"code": "COW", "name": "Cowper", "lat": 53.3190, "lon": -6.2590, "line": "green"},
    {"code": "MIL", "name": "Milltown", "lat": 53.3110, "lon": -6.2510, "line": "green"},
    {"code": "WIN", "name": "Windy Arbour", "lat": 53.3060, "lon": -6.2470, "line": "green"},
    {"code": "DUN", "name": "Dundrum", "lat": 53.2970, "lon": -6.2370, "line": "green"},
    {"code": "CHR", "name": "Charlemont", "lat": 53.3310, "lon": -6.2580, "line": "green"},
    {"code": "HAR", "name": "Harcourt", "lat": 53.3340, "lon": -6.2620, "line": "green"},
    {"code": "STS", "name": "St. Stephen's Green", "lat": 53.3390, "lon": -6.2610, "line": "green"},
    {"code": "WES", "name": "Westmoreland", "lat": 53.3462, "lon": -6.2593, "line": "green"},
    {"code": "OCP", "name": "O'Connell GPO", "lat": 53.3490, "lon": -6.2602, "line": "green"},
    {"code": "MAR", "name": "Marlborough", "lat": 53.3501, "lon": -6.2576, "line": "green"},
    {"code": "PAR", "name": "Parnell", "lat": 53.3530, "lon": -6.2631, "line": "green"},
    {"code": "DOM", "name": "Dominick", "lat": 53.3527, "lon": -6.2706, "line": "green"},
    {"code": "BRO", "name": "Broadstone DIT", "lat": 53.3556, "lon": -6.2756, "line": "green"},
    {"code": "PHI", "name": "Phibsborough", "lat": 53.3585, "lon": -6.2720, "line": "green"},
    {"code": "CAB", "name": "Cabra", "lat": 53.3635, "lon": -6.2820, "line": "green"},
    {"code": "BRM", "name": "Broombridge", "lat": 53.3720, "lon": -6.2975, "line": "green"},
    # ─── Red Line ───
    {"code": "TPT", "name": "The Point", "lat": 53.3492, "lon": -6.2290, "line": "red"},
    {"code": "SDK", "name": "Spencer Dock", "lat": 53.3489, "lon": -6.2373, "line": "red"},
    {"code": "MYS", "name": "Mayor Square NCI", "lat": 53.3494, "lon": -6.2427, "line": "red"},
    {"code": "GDK", "name": "George's Dock", "lat": 53.3494, "lon": -6.2480, "line": "red"},
    {"code": "CON", "name": "Connolly", "lat": 53.3505, "lon": -6.2500, "line": "red"},
    {"code": "BUS", "name": "Busáras", "lat": 53.3499, "lon": -6.2520, "line": "red"},
    {"code": "ABB", "name": "Abbey Street", "lat": 53.3484, "lon": -6.2585, "line": "red"},
    {"code": "JER", "name": "Jervis", "lat": 53.3474, "lon": -6.2662, "line": "red"},
    {"code": "FOU", "name": "Four Courts", "lat": 53.3467, "lon": -6.2745, "line": "red"},
    {"code": "SMI", "name": "Smithfield", "lat": 53.3474, "lon": -6.2785, "line": "red"},
    {"code": "MUS", "name": "Museum", "lat": 53.3475, "lon": -6.2864, "line": "red"},
    {"code": "HEU", "name": "Heuston", "lat": 53.3465, "lon": -6.2929, "line": "red"},
    {"code": "JAM", "name": "James's", "lat": 53.3419, "lon": -6.2948, "line": "red"},
    {"code": "FAT", "name": "Fatima", "lat": 53.3376, "lon": -6.2928, "line": "red"},
    {"code": "RIA", "name": "Rialto", "lat": 53.3361, "lon": -6.2968, "line": "red"},
    {"code": "SUI", "name": "Suir Road", "lat": 53.3355, "lon": -6.3043, "line": "red"},
    {"code": "GOL", "name": "Goldenbridge", "lat": 53.3352, "lon": -6.3130, "line": "red"},
    {"code": "DRI", "name": "Drimnagh", "lat": 53.3341, "lon": -6.3200, "line": "red"},
    {"code": "BLA", "name": "Blackhorse", "lat": 53.3334, "lon": -6.3278, "line": "red"},
    {"code": "BLU", "name": "Bluebell", "lat": 53.3314, "lon": -6.3338, "line": "red"},
    {"code": "KYL", "name": "Kylemore", "lat": 53.3292, "lon": -6.3422, "line": "red"},
    {"code": "RED", "name": "Red Cow", "lat": 53.3165, "lon": -6.3680, "line": "red"},
    {"code": "KIN", "name": "Kingswood", "lat": 53.3067, "lon": -6.3880, "line": "red"},
    {"code": "BEL", "name": "Belgard", "lat": 53.2990, "lon": -6.3752, "line": "red"},
    {"code": "COO", "name": "Cookstown", "lat": 53.2941, "lon": -6.3802, "line": "red"},
    {"code": "HOS", "name": "Hospital", "lat": 53.2899, "lon": -6.3794, "line": "red"},
    {"code": "TAL", "name": "Tallaght", "lat": 53.2875, "lon": -6.3735, "line": "red"},
    {"code": "FET", "name": "Fettercairn", "lat": 53.2831, "lon": -6.3968, "line": "red"},
    {"code": "CVN", "name": "Cheeverstown", "lat": 53.2740, "lon": -6.3972, "line": "red"},
    {"code": "CIT", "name": "Citywest Campus", "lat": 53.2693, "lon": -6.4048, "line": "red"},
    {"code": "FOR", "name": "Fortunestown", "lat": 53.2641, "lon": -6.4025, "line": "red"},
    {"code": "SAG", "name": "Saggart", "lat": 53.2577, "lon": -6.4387, "line": "red"},
]


@dataclass
class LuasForecast:
    """A single Luas arrival forecast."""

    stop_code: str
    stop_name: str
    direction: str  # "Inbound" or "Outbound"
    destination: str
    due_minutes: int  # 0 = "DUE", -1 parsing error
    line: str  # "red" or "green"


@dataclass
class LuasState:
    """In-memory state for Luas forecasts."""

    forecasts: dict[str, list[LuasForecast]] = field(default_factory=dict)  # stop_code → forecasts
    last_fetched: dict[str, float] = field(default_factory=dict)
    _client: httpx.AsyncClient | None = None
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def fetch_stop(self, stop_code: str) -> list[LuasForecast]:
        """Fetch forecast for a single Luas stop."""
        now = time.time()
        cached = self.last_fetched.get(stop_code, 0)
        if now - cached < CACHE_TTL and stop_code in self.forecasts:
            return self.forecasts[stop_code]

        client = await self._get_client()
        try:
            resp = await client.get(
                LUAS_FORECAST_URL,
                params={
                    "action": "forecast",
                    "stop": stop_code,
                    "encrypt": "false",
                },
            )
            resp.raise_for_status()
            forecasts = self._parse_xml(resp.text, stop_code)
            self.forecasts[stop_code] = forecasts
            self.last_fetched[stop_code] = now
            return forecasts
        except Exception as e:
            logger.warning("luas.fetch_error", stop=stop_code, error=str(e))
            return self.forecasts.get(stop_code, [])

    def _parse_xml(self, xml_text: str, stop_code: str) -> list[LuasForecast]:
        """Parse Luas forecast XML response."""
        forecasts = []
        try:
            root = ET.fromstring(xml_text)
            stop_info = next((s for s in LUAS_STOPS if s["code"] == stop_code), None)
            stop_name = stop_info["name"] if stop_info else stop_code
            line = stop_info["line"] if stop_info else "unknown"

            for direction_elem in root.findall("direction"):
                dir_name = direction_elem.get("name", "Unknown")
                for tram in direction_elem.findall("tram"):
                    due = tram.get("dueMins", "")
                    dest = tram.get("destination", "")
                    if due.upper() == "DUE":
                        due_min = 0
                    else:
                        try:
                            due_min = int(due)
                        except (ValueError, TypeError):
                            due_min = -1
                    if due_min >= 0:
                        forecasts.append(
                            LuasForecast(
                                stop_code=stop_code,
                                stop_name=stop_name,
                                direction=dir_name,
                                destination=dest,
                                due_minutes=due_min,
                                line=line,
                            )
                        )
        except ET.ParseError as e:
            logger.warning("luas.xml_parse_error", stop=stop_code, error=str(e))
        return forecasts

    async def fetch_nearby(self, lat: float, lon: float, radius_km: float = 1.0) -> list[dict]:
        """Fetch forecasts for stops near a point."""
        import math

        nearby = []
        for stop in LUAS_STOPS:
            dlat = math.radians(stop["lat"] - lat)
            dlon = math.radians(stop["lon"] - lon)
            a = (
                math.sin(dlat / 2) ** 2
                + math.cos(math.radians(lat))
                * math.cos(math.radians(stop["lat"]))
                * math.sin(dlon / 2) ** 2
            )
            d = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            if d <= radius_km:
                forecasts = await self.fetch_stop(stop["code"])
                nearby.append({
                    "stop": stop,
                    "distance_km": round(d, 3),
                    "forecasts": forecasts,
                })
        nearby.sort(key=lambda x: x["distance_km"])
        return nearby

    def get_all_stops(self) -> list[dict]:
        """Return all Luas stops with static info."""
        return LUAS_STOPS

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Module singleton
luas_state = LuasState()
