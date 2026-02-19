"""Background ingestion task — runs inside the FastAPI process for local dev.

When Docker isn't available, we can't run the ingestion service separately
because they need to share the same Redis instance (fakeredis is in-memory).

This module spins up the GTFS-RT poller as an asyncio background task
within the FastAPI app's lifespan, writing directly to the shared Redis.
"""

from __future__ import annotations

import asyncio

import structlog

from backend.core.config import settings
from backend.core.redis import get_redis
from ingestion.gtfs_realtime.poller import GtfsRealtimePoller
from ingestion.gtfs_static.loader import gtfs_static

logger = structlog.get_logger()

POLL_INTERVAL = 15  # seconds (NTA rate limit ~4 req/min)


async def start_background_ingestion() -> asyncio.Task:
    """Start the GTFS-RT poller as a background asyncio task.

    Returns the task handle for cancellation on shutdown.
    """
    # Load GTFS static data (route name mapping)
    await gtfs_static.load()
    logger.info(
        "bg_ingestion.gtfs_static_ready",
        routes=len(gtfs_static.route_map),
        trips=len(gtfs_static.trip_route_map),
    )

    # Create poller with shared Redis client and API key from settings
    redis_client = get_redis()
    api_key = settings.NTA_API_KEY
    if not api_key:
        logger.error("bg_ingestion.no_api_key", msg="NTA_API_KEY not set in .env")

    poller = GtfsRealtimePoller(api_key=api_key, redis_client=redis_client)

    task = asyncio.create_task(_poll_loop(poller), name="bg_gtfs_rt")
    logger.info("bg_ingestion.started", interval=POLL_INTERVAL, has_key=bool(api_key))
    return task


async def _poll_loop(poller: GtfsRealtimePoller) -> None:
    """Infinite poll loop with error recovery."""
    backoff = POLL_INTERVAL
    while True:
        try:
            await poller.poll()
            backoff = POLL_INTERVAL  # reset on success
        except asyncio.CancelledError:
            await poller.close()
            raise
        except Exception:
            logger.exception("bg_ingestion.poll_error")
            backoff = min(backoff * 2, 300)
        await asyncio.sleep(backoff)
