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

    yield

    logger.info("busiq.shutdown")
    ingestion_task.cancel()
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
