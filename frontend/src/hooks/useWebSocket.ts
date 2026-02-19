"use client";

import { useEffect, useRef, useCallback } from "react";
import { useBusStore } from "@/lib/store";
import type { VehiclePosition } from "@/lib/types";

const WS_URL =
    process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/ws/live";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

interface WsMessage {
    type: "snapshot";
    vehicles: VehiclePosition[];
    timestamp: string;
    count?: number;
}

/**
 * useWebSocket — connects to BusIQ backend WebSocket.
 *
 * Receives vehicle position snapshots every ~10 seconds
 * and pushes them into the Zustand store. The map layers
 * reactively re-render from the store.
 *
 * Handles reconnection with exponential backoff.
 */
export function useWebSocket() {
    const setVehicles = useBusStore((s) => s.setVehicles);
    const setConnected = useBusStore((s) => s.setConnected);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectDelay = useRef(RECONNECT_DELAY_MS);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            reconnectDelay.current = RECONNECT_DELAY_MS;
            console.log("[BusIQ] WebSocket connected");
        };

        ws.onmessage = (event) => {
            try {
                const msg: WsMessage = JSON.parse(event.data);
                if (msg.type === "snapshot" && Array.isArray(msg.vehicles)) {
                    setVehicles(msg.vehicles);
                }
            } catch (err) {
                console.error("[BusIQ] Failed to parse WS message:", err);
            }
        };

        ws.onclose = () => {
            setConnected(false);
            console.log(
                `[BusIQ] WebSocket closed, reconnecting in ${reconnectDelay.current}ms`
            );
            reconnectTimer.current = setTimeout(() => {
                reconnectDelay.current = Math.min(
                    reconnectDelay.current * 1.5,
                    MAX_RECONNECT_DELAY_MS
                );
                connect();
            }, reconnectDelay.current);
        };

        ws.onerror = (err) => {
            console.error("[BusIQ] WebSocket error:", err);
            ws.close();
        };
    }, [setVehicles, setConnected]);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);
}
