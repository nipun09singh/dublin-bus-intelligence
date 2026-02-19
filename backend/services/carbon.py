"""Carbon savings calculator — CO₂ estimates per journey.

Compares multimodal public transport journeys against private car driving.
Used for the persistent carbon badge in Smart Cities mode.

Sources:
- Average car: 170g CO₂/km (Irish EPA average for passenger vehicles)
- Dublin Bus: 89g CO₂/km per passenger (NTA sustainability report, approximate)
- Luas: 25g CO₂/km per passenger (electric tram, grid-average)
- DART: 30g CO₂/km per passenger (electric rail, grid-average)
- Dublin Bikes: 0g CO₂/km (human-powered)
- Walking: 0g CO₂/km
"""

from __future__ import annotations

from dataclasses import dataclass

# grams CO₂ per passenger-kilometre
EMISSIONS_PER_KM: dict[str, float] = {
    "bus": 89.0,
    "luas": 25.0,
    "dart": 30.0,
    "bike": 0.0,
    "walk": 0.0,
    "car": 170.0,  # comparison baseline
}


@dataclass
class CarbonResult:
    """CO₂ comparison for a journey."""

    journey_co2_grams: float
    car_co2_grams: float
    savings_grams: float
    savings_percent: float
    savings_kg: float
    equivalent_trees_day: float  # 1 mature tree absorbs ~22kg CO₂/year ≈ 60g/day


def calculate_carbon(segments: list[dict]) -> CarbonResult:
    """Calculate CO₂ emissions for a multimodal journey.

    Each segment: {"mode": "bus"|"luas"|"dart"|"bike"|"walk", "distance_km": float}
    """
    journey_co2 = 0.0
    total_km = 0.0

    for seg in segments:
        mode = seg.get("mode", "walk")
        dist = seg.get("distance_km", 0.0)
        total_km += dist
        rate = EMISSIONS_PER_KM.get(mode, EMISSIONS_PER_KM["car"])
        journey_co2 += rate * dist

    car_co2 = EMISSIONS_PER_KM["car"] * total_km
    savings = max(0, car_co2 - journey_co2)
    pct = (savings / car_co2 * 100) if car_co2 > 0 else 0

    return CarbonResult(
        journey_co2_grams=round(journey_co2, 1),
        car_co2_grams=round(car_co2, 1),
        savings_grams=round(savings, 1),
        savings_percent=round(pct, 1),
        savings_kg=round(savings / 1000, 2),
        equivalent_trees_day=round(savings / 60, 2),  # ~60g/day per mature tree
    )
