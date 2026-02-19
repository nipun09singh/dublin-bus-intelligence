"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface GhostBus {
    vehicle_id: string;
    route_id: string;
    route_short_name: string;
    last_latitude: number;
    last_longitude: number;
    last_seen: string;
    stale_seconds: number;
    ghost_type: string;
}

interface GhostRoute {
    route_id: string;
    route_short_name: string;
}

interface GhostData {
    ghost_buses: GhostBus[];
    ghost_routes: GhostRoute[];
    summary: {
        total_live_vehicles: number;
        total_ghost_vehicles: number;
        total_routes_with_buses: number;
        total_routes_without_buses: number;
    };
}

/**
 * GhostBusPanel — Phase 3 optimisation panel showing ghost buses.
 *
 * Ghosts = vehicles with stale data (>120s) or routes with zero buses.
 * Appears in optimise mode on the left side below PulseRing.
 * Updates every 30 seconds.
 */
export default function GhostBusPanel() {
    const [data, setData] = useState<GhostData | null>(null);
    const [expanded, setExpanded] = useState(false);

    const fetchGhosts = useCallback(async () => {
        try {
            const resp = await fetch(`${API_URL}/predictions/ghosts`);
            if (!resp.ok) return;
            const json = await resp.json();
            setData(json.data);
        } catch {
            // Silently fail — panel just shows "loading"
        }
    }, []);

    useEffect(() => {
        fetchGhosts();
        const interval = setInterval(fetchGhosts, 30000);
        return () => clearInterval(interval);
    }, [fetchGhosts]);

    if (!data) return null;

    const { summary, ghost_buses, ghost_routes } = data;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute top-80 right-4 sm:right-6 z-40 w-56 sm:w-64"
        >
            <div className="glass p-3">
                {/* Header */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between mb-2"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm opacity-50">👻</span>
                        <span
                            className="text-xs font-semibold tracking-wider"
                            style={{ color: "var(--text-primary)" }}
                        >
                            GHOST BUSES
                        </span>
                    </div>
                    <span
                        className="text-[10px]"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {expanded ? "▲" : "▼"}
                    </span>
                </button>

                {/* Summary stats */}
                <div className="flex items-center gap-3 mb-2">
                    <div className="flex flex-col items-center">
                        <span
                            className="tabular-nums text-lg font-bold"
                            style={{ color: "var(--data-warning)" }}
                        >
                            {summary.total_ghost_vehicles}
                        </span>
                        <span
                            className="text-[8px] tracking-wider"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            SIGNAL LOST
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span
                            className="tabular-nums text-lg font-bold"
                            style={{ color: "var(--data-error)" }}
                        >
                            {summary.total_routes_without_buses}
                        </span>
                        <span
                            className="text-[8px] tracking-wider"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            DEAD ROUTES
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span
                            className="tabular-nums text-lg font-bold"
                            style={{ color: "var(--data-success)" }}
                        >
                            {summary.total_live_vehicles}
                        </span>
                        <span
                            className="text-[8px] tracking-wider"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            LIVE
                        </span>
                    </div>
                </div>

                {/* Expandable details */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            {/* Ghost buses list */}
                            {ghost_buses.length > 0 && (
                                <div
                                    className="pt-2 mt-2"
                                    style={{
                                        borderTop:
                                            "1px solid rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <div
                                        className="text-[9px] font-medium tracking-wider mb-1.5"
                                        style={{
                                            color: "var(--text-tertiary)",
                                        }}
                                    >
                                        SIGNAL-LOST VEHICLES
                                    </div>
                                    <div className="space-y-1 max-h-28 overflow-y-auto">
                                        {ghost_buses.slice(0, 8).map((g) => (
                                            <div
                                                key={g.vehicle_id}
                                                className="glass-nested px-2 py-1.5 flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="text-[10px] font-bold"
                                                        style={{
                                                            color: "#00A8B5",
                                                        }}
                                                    >
                                                        {g.route_short_name}
                                                    </span>
                                                    <span
                                                        className="text-[9px]"
                                                        style={{
                                                            color: "var(--text-tertiary)",
                                                        }}
                                                    >
                                                        #{g.vehicle_id}
                                                    </span>
                                                </div>
                                                <span
                                                    className="text-[9px] tabular-nums"
                                                    style={{
                                                        color: "var(--data-warning)",
                                                    }}
                                                >
                                                    {Math.round(
                                                        g.stale_seconds / 60
                                                    )}
                                                    m ago
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Dead routes */}
                            {ghost_routes.length > 0 && (
                                <div className="mt-2">
                                    <div
                                        className="text-[9px] font-medium tracking-wider mb-1.5"
                                        style={{
                                            color: "var(--text-tertiary)",
                                        }}
                                    >
                                        ROUTES WITH NO BUSES (
                                        {ghost_routes.length})
                                    </div>
                                    <div
                                        className="flex flex-wrap gap-1 max-h-16 overflow-y-auto"
                                    >
                                        {ghost_routes.slice(0, 20).map((r) => (
                                            <span
                                                key={r.route_id}
                                                className="text-[9px] px-1.5 py-0.5 rounded"
                                                style={{
                                                    background:
                                                        "rgba(201,53,69,0.15)",
                                                    color: "var(--data-error)",
                                                }}
                                            >
                                                {r.route_short_name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
