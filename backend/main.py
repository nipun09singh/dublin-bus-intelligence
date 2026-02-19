"""BusIQ API entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1.router import api_router
from backend.core.config import settings
from backend.core.database import close_db, init_db
from backend.core.redis import close_redis, init_redis

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown events."""
    logger.info("busiq.startup", environment=settings.ENVIRONMENT)
    await init_redis()
    await init_db()

    # Start background ingestion (polls NTA every 10s, writes to Redis)
    from backend.services.ingestion import start_background_ingestion
    ingestion_task = await start_background_ingestion()

    # Start stats collector (snapshots every 5 min for historical analysis)
    from backend.services.stats_collector import start_stats_collector
    stats_task = await start_stats_collector()

    yield

    logger.info("busiq.shutdown")
    ingestion_task.cancel()
    stats_task.cancel()
    try:
        await ingestion_task
    except Exception:
        pass
    await close_redis()
    await close_db()


app = FastAPI(
    title="BusIQ",
    description="Real-time intelligence layer for Dublin's bus network",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "busiq"}


@app.get("/debug/status")
async def debug_status():
    """Debug endpoint: check ingestion status."""
    import asyncio
    from backend.core.redis import get_redis
    redis = get_redis()
    fleet_members = await redis.smembers("busiq:fleet")
    fleet_ts = await redis.get("busiq:fleet:ts")
    has_key = bool(settings.NTA_API_KEY)
    key_prefix = settings.NTA_API_KEY[:8] + "..." if has_key else "(empty)"
    # Check background tasks
    tasks = [t.get_name() for t in asyncio.all_tasks() if not t.done()]
    return {
        "nta_key_set": has_key,
        "nta_key_prefix": key_prefix,
        "fleet_size": len(fleet_members),
        "fleet_ts": fleet_ts,
        "background_tasks": tasks,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/api/v1/insights")
async def insights():
    """Return aggregated stats for the BusIQ Insights page."""
    from backend.services.stats_collector import get_stats_summary, collect_stats_snapshot
    summary = get_stats_summary()
    # Also include a live snapshot for current state
    live = await collect_stats_snapshot()
    return {"summary": summary, "live": live}
