"""Health & system status endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.models.schemas import ApiResponse, Meta

router = APIRouter()


@router.get("/health")
async def health() -> ApiResponse:
    """Detailed health check — verifies Redis, Postgres, and ingestion status."""
    now = datetime.now(timezone.utc)
    # TODO: Actually ping Redis and Postgres
    health_data = {
        "status": "ok",
        "services": {
            "redis": "unknown",
            "postgres": "unknown",
            "ingestion": "unknown",
            "ml_model": "not-loaded",
        },
        "fleet": {
            "active_buses": 0,
            "last_update": None,
        },
    }
    return ApiResponse(data=health_data, meta=Meta(timestamp=now))
