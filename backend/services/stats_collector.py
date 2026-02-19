"""BusIQ Statistics Collector — logs network metrics over time.

Runs as a background task alongside ingestion. Every 5 minutes, it
snapshots key network metrics and appends to a local JSON-lines file.
This gives us historical data to say things like:
  "Over the past week, BusIQ detected 847 bunching events across 94 routes."
  "Average on-time performance: 52%. Ghost bus rate peaked at 14% during evening rush."

Data is stored in data/stats.jsonl — one JSON object per line, timestamped.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import structlog

from backend.core.redis import get_all_vehicles
from backend.services.ghost_detection import detect_ghost_buses
from backend.services.bunching_detection import detect_bunching
from backend.services.crowd_reports import get_crowding_snapshot

logger = structlog.get_logger()

STATS_DIR = Path(__file__).parent.parent.parent / "data"
STATS_FILE = STATS_DIR / "stats.jsonl"
COLLECTION_INTERVAL = 300  # 5 minutes


async def collect_stats_snapshot() -> dict:
    """Collect a single snapshot of network metrics."""
    vehicles = await get_all_vehicles()
    if not vehicles:
        return {}

    total = len(vehicles)

    # On-time analysis
    on_time = sum(1 for v in vehicles if abs(v.get("delay_seconds", 0)) <= 300)
    slight_delay = sum(1 for v in vehicles if 300 < abs(v.get("delay_seconds", 0)) <= 600)
    moderate_delay = sum(1 for v in vehicles if 600 < abs(v.get("delay_seconds", 0)) <= 900)
    severe_delay = sum(1 for v in vehicles if abs(v.get("delay_seconds", 0)) > 900)
    on_time_pct = round(on_time / total * 100, 1) if total else 0

    # Routes active
    active_routes = set()
    route_vehicles: dict[str, int] = {}
    for v in vehicles:
        rid = v.get("route_id", "")
        rsn = v.get("route_short_name", rid)
        if rsn:
            active_routes.add(rsn)
            route_vehicles[rsn] = route_vehicles.get(rsn, 0) + 1

    # Ghost detection
    ghost_report = await detect_ghost_buses()
    signal_lost = len(ghost_report.signal_lost)
    dead_routes = len(ghost_report.dead_routes)
    ghost_rate = round(signal_lost / total * 100, 1) if total else 0

    # Bunching detection
    bunching = await detect_bunching()
    bunching_pairs = bunching.total_pairs
    bunching_routes = bunching.routes_affected
    bunching_severe = sum(1 for a in bunching.alerts if a.severity == "severe")

    # Crowd reports
    try:
        crowding = await get_crowding_snapshot()
        crowd_reports = crowding.total_reports
        full_reports = sum(1 for r in crowding.route_summaries if r.get("dominant_level") == "full")
    except Exception:
        crowd_reports = 0
        full_reports = 0

    # Top delayed routes
    route_delays: dict[str, list[int]] = {}
    for v in vehicles:
        rsn = v.get("route_short_name", v.get("route_id", ""))
        delay = v.get("delay_seconds", 0)
        if rsn:
            route_delays.setdefault(rsn, []).append(delay)

    top_delayed = sorted(
        [
            {"route": r, "avg_delay": round(sum(d) / len(d)), "vehicles": len(d)}
            for r, d in route_delays.items() if len(d) >= 3
        ],
        key=lambda x: x["avg_delay"],
        reverse=True,
    )[:10]

    # Average delay across network
    all_delays = [v.get("delay_seconds", 0) for v in vehicles]
    avg_delay = round(sum(all_delays) / len(all_delays)) if all_delays else 0

    # Hour of day (for time-series analysis)
    now = datetime.now(timezone.utc)
    hour = now.hour

    return {
        "timestamp": now.isoformat(),
        "hour": hour,
        "weekday": now.strftime("%A"),
        "total_vehicles": total,
        "active_routes": len(active_routes),
        "on_time": on_time,
        "on_time_pct": on_time_pct,
        "slight_delay": slight_delay,
        "moderate_delay": moderate_delay,
        "severe_delay": severe_delay,
        "avg_delay_seconds": avg_delay,
        "ghost_signal_lost": signal_lost,
        "ghost_dead_routes": dead_routes,
        "ghost_rate_pct": ghost_rate,
        "bunching_pairs": bunching_pairs,
        "bunching_routes": bunching_routes,
        "bunching_severe": bunching_severe,
        "crowd_reports": crowd_reports,
        "crowd_full_routes": full_reports,
        "top_delayed_routes": top_delayed,
    }


async def _stats_loop() -> None:
    """Background loop that collects stats every COLLECTION_INTERVAL seconds."""
    STATS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("stats_collector.started", interval=COLLECTION_INTERVAL, file=str(STATS_FILE))

    while True:
        try:
            await asyncio.sleep(COLLECTION_INTERVAL)
            snapshot = await collect_stats_snapshot()
            if snapshot:
                with open(STATS_FILE, "a", encoding="utf-8") as f:
                    f.write(json.dumps(snapshot) + "\n")
                logger.info(
                    "stats_collector.snapshot",
                    vehicles=snapshot["total_vehicles"],
                    on_time_pct=snapshot["on_time_pct"],
                    bunching=snapshot["bunching_pairs"],
                    ghosts=snapshot["ghost_signal_lost"],
                )
        except Exception:
            logger.exception("stats_collector.error")


async def start_stats_collector() -> asyncio.Task:
    """Start the background stats collection task."""
    return asyncio.create_task(_stats_loop())


def get_stats_summary() -> dict:
    """Read all collected stats and compute aggregate summary.

    Returns a summary suitable for the Insights page and submission documents.
    """
    if not STATS_FILE.exists():
        return {"error": "No stats collected yet", "snapshots": 0}

    snapshots = []
    with open(STATS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    snapshots.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    if not snapshots:
        return {"error": "No valid stats", "snapshots": 0}

    n = len(snapshots)
    first = snapshots[0]["timestamp"]
    last = snapshots[-1]["timestamp"]

    # Aggregate metrics
    avg_on_time = round(sum(s["on_time_pct"] for s in snapshots) / n, 1)
    avg_vehicles = round(sum(s["total_vehicles"] for s in snapshots) / n)
    avg_bunching = round(sum(s["bunching_pairs"] for s in snapshots) / n, 1)
    avg_ghost_rate = round(sum(s["ghost_rate_pct"] for s in snapshots) / n, 1)
    total_bunching_events = sum(s["bunching_pairs"] for s in snapshots)
    total_ghost_events = sum(s["ghost_signal_lost"] for s in snapshots)
    max_bunching = max(s["bunching_pairs"] for s in snapshots)
    max_ghost_rate = max(s["ghost_rate_pct"] for s in snapshots)
    avg_delay = round(sum(s["avg_delay_seconds"] for s in snapshots) / n)

    # Peak hour analysis
    hour_data: dict[int, list[float]] = {}
    for s in snapshots:
        h = s["hour"]
        hour_data.setdefault(h, []).append(s["on_time_pct"])
    peak_hours = sorted(
        [{"hour": h, "avg_on_time_pct": round(sum(v) / len(v), 1)} for h, v in hour_data.items()],
        key=lambda x: x["avg_on_time_pct"],
    )

    # Worst-performing routes across all snapshots
    route_counts: dict[str, int] = {}
    for s in snapshots:
        for r in s.get("top_delayed_routes", []):
            name = r["route"]
            route_counts[name] = route_counts.get(name, 0) + 1
    worst_routes = sorted(route_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "snapshots": n,
        "period_start": first,
        "period_end": last,
        "avg_vehicles_tracked": avg_vehicles,
        "avg_on_time_pct": avg_on_time,
        "avg_delay_seconds": avg_delay,
        "avg_bunching_pairs_per_snapshot": avg_bunching,
        "total_bunching_events_observed": total_bunching_events,
        "max_bunching_pairs_single_snapshot": max_bunching,
        "avg_ghost_rate_pct": avg_ghost_rate,
        "max_ghost_rate_pct": max_ghost_rate,
        "total_ghost_events_observed": total_ghost_events,
        "worst_hours_for_on_time": peak_hours[:3] if peak_hours else [],
        "best_hours_for_on_time": peak_hours[-3:] if peak_hours else [],
        "most_frequently_delayed_routes": [{"route": r, "appearances": c} for r, c in worst_routes],
    }
