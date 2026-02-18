"""Custom exception classes for BusIQ."""

from __future__ import annotations

from fastapi import HTTPException, status


class BusIQException(Exception):
    """Base exception for BusIQ."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class DataSourceUnavailable(BusIQException):
    """Raised when an external data source (NTA, Met Éireann, etc.) is unreachable."""


class VehicleNotFound(HTTPException):
    """Raised when a vehicle ID is not found in the live state."""

    def __init__(self, vehicle_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle '{vehicle_id}' not found in live state",
        )


class RouteNotFound(HTTPException):
    """Raised when a route ID is not found."""

    def __init__(self, route_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route '{route_id}' not found",
        )


class PredictionUnavailable(HTTPException):
    """Raised when the ML model cannot produce a prediction."""

    def __init__(self, reason: str) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Prediction unavailable: {reason}",
        )
