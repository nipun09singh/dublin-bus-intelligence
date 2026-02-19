"""Operations endpoints — Intervention Engine + Network Health Score.

The core BusIQ differentiator: not just showing problems, but
generating specific actionable interventions with one-click approve.
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.services.intervention_engine import (
    generate_interventions,
    get_active_interventions,
    action_intervention,
    get_intervention_history,
)
from backend.services.network_health import calculate_network_health

router = APIRouter()


class InterventionAction(BaseModel):
    """Request body for approving/dismissing an intervention."""
    action: str  # "approve" or "dismiss"


@router.get("/interventions")
async def list_interventions(
    refresh: bool = Query(False, description="Force regenerate interventions"),
) -> dict:
    """Get all active interventions from the Intervention Engine.

    Returns a prioritised list of actionable recommendations:
    HOLD, DEPLOY, SURGE, EXPRESS — each with estimated impact.

    Set ?refresh=true to re-run the engine (otherwise serves from cache).
    """
    now = datetime.now(timezone.utc)

    if refresh:
        interventions_raw = await generate_interventions()
        interventions = [i.to_dict() for i in interventions_raw]
    else:
        interventions = await get_active_interventions()
        if not interventions:
            interventions_raw = await generate_interventions()
            interventions = [i.to_dict() for i in interventions_raw]

    # Group by type
    by_type = {}
    for intv in interventions:
        t = intv.get("type", "UNKNOWN")
        by_type.setdefault(t, []).append(intv)

    return {
        "data": {
            "interventions": interventions,
            "by_type": by_type,
            "summary": {
                "total": len(interventions),
                "pending": sum(1 for i in interventions if i.get("status") == "pending"),
                "approved": sum(1 for i in interventions if i.get("status") == "approved"),
                "dismissed": sum(1 for i in interventions if i.get("status") == "dismissed"),
                "critical": sum(1 for i in interventions if i.get("priority") == "critical"),
                "high": sum(1 for i in interventions if i.get("priority") == "high"),
            },
        },
        "meta": {
            "timestamp": now.isoformat(),
            "version": "1.0",
        },
    }


@router.post("/interventions/{intervention_id}")
async def update_intervention(
    intervention_id: str,
    body: InterventionAction,
) -> dict:
    """Approve or dismiss an intervention.

    One-click action for controllers. Updates the intervention status
    and records it in the intervention history.
    """
    if body.action not in ("approve", "dismiss"):
        return {"error": "Action must be 'approve' or 'dismiss'"}

    result = await action_intervention(intervention_id, body.action)

    if result is None:
        return {"error": "Intervention not found", "id": intervention_id}

    return {
        "data": result,
        "meta": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": body.action,
        },
    }


@router.get("/interventions/history")
async def intervention_history(
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """Get intervention history — what was approved/dismissed and when.

    This is the proof that BusIQ improves operations: measurable
    intervention history with outcomes.
    """
    history = await get_intervention_history(limit)

    return {
        "data": {
            "history": history,
            "total": len(history),
        },
        "meta": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


@router.get("/health")
async def network_health() -> dict:
    """Get the real-time Network Health Score (0-100).

    A single number that tells a controller: how healthy is my network
    RIGHT NOW? Broken down into components: on-time performance,
    route coverage, headway regularity, passenger comfort.
    """
    report = await calculate_network_health()

    return {
        "data": report.to_dict(),
        "meta": {
            "timestamp": report.generated_at,
            "version": "1.0",
        },
    }
