"""Prediction endpoints — ML-powered arrival predictions."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.models.schemas import ApiResponse, Meta, PredictionRequest, PredictionResponse

router = APIRouter()


@router.post("", response_model=ApiResponse)
async def predict_arrival(request: PredictionRequest) -> ApiResponse:
    """Predict next arrival for a route at a stop.

    Uses the LightGBM model (v1) served via ONNX Runtime.
    Returns our prediction alongside the official GTFS-RT ETA for comparison.
    """
    # TODO: Load ONNX model, build feature vector, predict
    now = datetime.now(timezone.utc)
    prediction = PredictionResponse(
        stop_id=request.stop_id,
        route_id=request.route_id,
        predicted_arrival=now,
        confidence=0.0,
        model_version="not-trained",
    )
    return ApiResponse(data=prediction, meta=Meta(timestamp=now))
