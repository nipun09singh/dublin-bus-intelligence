"""Ingestion service entrypoint.

Runs all data pollers concurrently:
  - GTFS-RT vehicle positions (every 10 seconds)
  - Weather data (every 30 minutes)
  - Event data (every 6 hours)
"""

from __future__ import annotations

import asyncio
import signal

import structlog

from ingestion.gtfs_realtime.poller import GtfsRealtimePoller

logger = structlog.get_logger()

# Polling intervals in seconds
GTFS_RT_INTERVAL = 10
WEATHER_INTERVAL = 1800  # 30 minutes
EVENTS_INTERVAL = 21600  # 6 hours


async def run_poller(name: str, poller_fn, interval: float) -> None:
    """Run a poller function on a fixed interval with error recovery."""
    while True:
        try:
            await poller_fn()
            logger.debug("poller.tick", poller=name)
        except Exception:
            logger.exception("poller.error", poller=name)
            # Exponential backoff on error (up to 5 minutes)
            await asyncio.sleep(min(interval * 2, 300))
            continue
        await asyncio.sleep(interval)


async def main() -> None:
    """Start all ingestion workers."""
    logger.info("ingestion.startup", pollers=["gtfs_rt", "weather", "events"])

    gtfs_rt = GtfsRealtimePoller()

    tasks = [
        asyncio.create_task(
            run_poller("gtfs_rt", gtfs_rt.poll, GTFS_RT_INTERVAL),
            name="gtfs_rt_poller",
        ),
        # TODO: Add weather poller
        # TODO: Add events poller
    ]

    # Graceful shutdown on SIGINT/SIGTERM
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda: [t.cancel() for t in tasks])
        except NotImplementedError:
            # Windows doesn't support add_signal_handler
            pass

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        logger.info("ingestion.shutdown")


if __name__ == "__main__":
    asyncio.run(main())
