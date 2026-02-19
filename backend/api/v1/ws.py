"""WebSocket endpoint for real-time vehicle position streaming.

Clients connect to /ws/live and receive:
  - Initial snapshot of all vehicles
  - Subsequent snapshots every ~10 seconds via Redis pub/sub
  - Falls back to polling when pub/sub is unavailable (fakeredis)

This is the data pipeline that makes buses appear live on the Nerve Centre map.
"""

from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from backend.core.redis import CHANNEL, get_all_vehicles, get_fleet_timestamp, get_redis

logger = structlog.get_logger()

router = APIRouter()


@router.websocket("/ws/live")
async def websocket_live(ws: WebSocket) -> None:
    """Stream live vehicle positions to connected clients."""
    await ws.accept()
    logger.info("ws.connected", client=str(ws.client))

    # Send initial snapshot
    try:
        vehicles = await get_all_vehicles()
        ts = await get_fleet_timestamp()
        await ws.send_json({
            "type": "snapshot",
            "vehicles": vehicles,
            "timestamp": ts or "",
            "count": len(vehicles),
        })
    except Exception:
        logger.exception("ws.initial_snapshot_failed")

    # Try pub/sub first, fall back to polling
    try:
        await _stream_via_pubsub(ws)
    except Exception:
        logger.info("ws.fallback_to_polling")
        await _stream_via_polling(ws)


async def _stream_via_pubsub(ws: WebSocket) -> None:
    """Stream updates via Redis pub/sub channel."""
    r = get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(CHANNEL)

    try:
        while True:
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=1.0,
            )
            if msg and msg["type"] == "message":
                data = msg["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                if ws.application_state != WebSocketState.CONNECTED:
                    break
                await ws.send_text(data)
            else:
                await asyncio.sleep(0.1)
    except (WebSocketDisconnect, Exception) as exc:
        logger.info("ws.disconnected", reason=type(exc).__name__)
    finally:
        await pubsub.unsubscribe(CHANNEL)
        await pubsub.close()


async def _stream_via_polling(ws: WebSocket) -> None:
    """Fallback: poll Redis every 5 seconds and send snapshots."""
    last_ts = ""
    try:
        while True:
            await asyncio.sleep(5)
            ts = await get_fleet_timestamp()
            if ts and ts != last_ts:
                last_ts = ts
                vehicles = await get_all_vehicles()
                if ws.application_state != WebSocketState.CONNECTED:
                    break
                await ws.send_json({
                    "type": "snapshot",
                    "vehicles": vehicles,
                    "timestamp": ts,
                    "count": len(vehicles),
                })
    except (WebSocketDisconnect, Exception) as exc:
        logger.info("ws.disconnected", reason=type(exc).__name__)
