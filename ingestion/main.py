"""Ingestion service entrypoint.

Runs all data pollers concurrently:
  - GTFS-RT vehicle positions + trip updates (every 10 seconds)
  - GTFS static data refresh (on startup, then daily)
"""

from __future__ import annotations

import asyncio
import os
import signal

import redis.asyncio as aioredis
import structlog

from ingestion.gtfs_realtime.poller import GtfsRealtimePoller
from ingestion.gtfs_static.loader import gtfs_static

logger = structlog.get_logger()

# Polling intervals in seconds
GTFS_RT_INTERVAL = 10


async def run_poller(name: str, poller_fn, interval: float) -> None:
    """Run a poller function on a fixed interval with error recovery."""
    backoff = interval
    while True:
        try:
            await poller_fn()
            backoff = interval  # reset on success
            logger.debug("poller.tick", poller=name)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("poller.error", poller=name)
            backoff = min(backoff * 2, 300)
        await asyncio.sleep(backoff)


async def main() -> None:
    """Start the ingestion pipeline."""
    logger.info("ingestion.startup")

    # ─── Initialize Redis ───
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        redis_client = aioredis.from_url(redis_url, decode_responses=True, max_connections=20)
        await redis_client.ping()
        logger.info("ingestion.redis_connected", url=redis_url)
    except Exception:
        logger.warning("ingestion.redis_fallback", reason="Using fakeredis in-memory store")
        import fakeredis.aioredis as fakeasync
        redis_client = fakeasync.FakeRedis(decode_responses=True)
        logger.info("ingestion.fakeredis_connected")

    # ─── Load GTFS Static (route name mapping) ───
    await gtfs_static.load()
    logger.info(
        "ingestion.gtfs_static_ready",
        routes=len(gtfs_static.route_map),
        trips=len(gtfs_static.trip_route_map),
    )

    # ─── Initialize Pollers ───
    api_key = os.getenv("NTA_API_KEY", "")
    gtfs_rt = GtfsRealtimePoller(api_key=api_key, redis_client=redis_client)

    tasks = [
        asyncio.create_task(
            run_poller("gtfs_rt", gtfs_rt.poll, GTFS_RT_INTERVAL),
            name="gtfs_rt_poller",
        ),
    ]

    # Graceful shutdown
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda: [t.cancel() for t in tasks])
        except NotImplementedError:
            pass  # Windows

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        logger.info("ingestion.shutdown")
    finally:
        await gtfs_rt.close()
        await redis_client.close()


if __name__ == "__main__":
    asyncio.run(main())
