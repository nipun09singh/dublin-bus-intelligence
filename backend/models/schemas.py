"""Pydantic schemas for API request/response models."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# ─── Enums ───


class OccupancyStatus(str, Enum):
    """GTFS-RT occupancy status values."""

    EMPTY = "EMPTY"
    MANY_SEATS_AVAILABLE = "MANY_SEATS_AVAILABLE"
    FEW_SEATS_AVAILABLE = "FEW_SEATS_AVAILABLE"
    STANDING_ROOM_ONLY = "STANDING_ROOM_ONLY"
    CRUSHED_STANDING_ROOM_ONLY = "CRUSHED_STANDING_ROOM_ONLY"
    FULL = "FULL"
    NOT_ACCEPTING_PASSENGERS = "NOT_ACCEPTING_PASSENGERS"
    UNKNOWN = "UNKNOWN"


class CrowdingLevel(str, Enum):
    """Crowdsourced crowding levels — one-tap report."""

    EMPTY = "empty"
    SEATS = "seats"
    STANDING = "standing"
    FULL = "full"


# ─── Vehicle / Bus ───


class VehiclePosition(BaseModel):
    """A single bus position — served from Redis live state."""

    vehicle_id: str
    route_id: str
    trip_id: str | None = None
    latitude: float
    longitude: float
    bearing: int | None = None
    speed_kmh: float | None = None
    occupancy_status: OccupancyStatus = OccupancyStatus.UNKNOWN
    delay_seconds: int = 0
    timestamp: datetime

    model_config = {"json_schema_extra": {"example": {
        "vehicle_id": "33017",
        "route_id": "39A",
        "trip_id": "39A_20260218_0830",
        "latitude": 53.3498,
        "longitude": -6.2603,
        "bearing": 215,
        "speed_kmh": 28.4,
        "occupancy_status": "MANY_SEATS_AVAILABLE",
        "delay_seconds": 45,
        "timestamp": "2026-02-18T08:32:14Z",
    }}}


class VehicleCollection(BaseModel):
    """Collection of vehicle positions — the full fleet snapshot."""

    vehicles: list[VehiclePosition]
    count: int
    timestamp: datetime


# ─── Predictions ───


class PredictionRequest(BaseModel):
    """Request for an arrival prediction."""

    stop_id: str
    route_id: str
    direction: int = Field(ge=0, le=1)


class PredictionResponse(BaseModel):
    """Predicted arrival with confidence and comparison to official."""

    stop_id: str
    route_id: str
    predicted_arrival: datetime
    confidence: float = Field(ge=0.0, le=1.0)
    official_eta: datetime | None = None
    improvement_seconds: int | None = None
    predicted_crowding: OccupancyStatus = OccupancyStatus.UNKNOWN
    model_version: str


# ─── Crowd Reports ───


class CrowdReportCreate(BaseModel):
    """Incoming crowdsource report from a passenger."""

    vehicle_id: str
    route_id: str
    crowding_level: CrowdingLevel
    latitude: float
    longitude: float


class CrowdReport(CrowdReportCreate):
    """Stored crowd report with server-side metadata."""

    id: int
    reported_at: datetime


# ─── Response Envelope ───


class Meta(BaseModel):
    """Standard response metadata."""

    timestamp: datetime
    version: str = "1.0"


class ApiResponse(BaseModel):
    """Standard response envelope per API design rules."""

    data: dict | list | BaseModel
    meta: Meta
