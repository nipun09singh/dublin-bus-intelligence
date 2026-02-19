"""API v1 router — aggregates all endpoint modules."""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.v1.buses import router as buses_router
from backend.api.v1.routes import router as routes_router
from backend.api.v1.predictions import router as predictions_router
from backend.api.v1.health import router as health_router
from backend.api.v1.ws import router as ws_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(buses_router, prefix="/buses", tags=["buses"])
api_router.include_router(routes_router, prefix="/routes", tags=["routes"])
api_router.include_router(predictions_router, prefix="/predictions", tags=["predictions"])
api_router.include_router(ws_router, tags=["websocket"])
