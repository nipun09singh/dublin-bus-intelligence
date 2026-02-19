"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface BunchingPair {
    vehicle_a: string;
    vehicle_b: string;
    route_id: string;
    route_short_name: string;
    distance_m: number;
    severity: string;
    midpoint_lat: number;
    midpoint_lon: number;
}

interface BunchingAlertData {
    route_id: string;
    route_short_name: string;
    pair_count: number;
    worst_distance_m: number;
    severity: string;
    bunched_pairs: BunchingPair[];
}

interface BunchingData {
    alerts: BunchingAlertData[];
    summary: {
        total_pairs: number;
        routes_affected: number;
        total_live_vehicles: number;
    };
}

const SEVERITY_COLORS: Record<string, string> = {
    severe: "var(--data-error)",
    moderate: "var(--data-warning)",
    mild: "var(--data-warm)",
};

const SEVERITY_BG: Record<string, string> = {
    severe: "rgba(201,53,69,0.15)",
    moderate: "rgba(243,156,18,0.15)",
    mild: "rgba(212,168,67,0.1)",
};

/**
 * BunchingAlertPanel — Phase 3 optimisation panel showing bunching alerts.
 *
 * Appears below the ghost bus panel in optimise mode.
 * Shows routes where buses are too close together.
 * Updates every 30 seconds.
 */
export default function BunchingAlertPanel() {
    const [data, setData] = useState<BunchingData | null>(null);
    const [expanded, setExpanded] = useState(false);

    const fetchBunching = useCallback(async () => {
        try {
            const resp = await fetch(`${API_URL}/predictions/bunching`);
            if (!resp.ok) return;
            const json = await resp.json();
            setData(json.data);
        } catch {
            // Silently fail
        }
    }, []);

    useEffect(() => {
        fetchBunching();
        const interval = setInterval(fetchBunching, 30000);
        return () => clearInterval(interval);
    }, [fetchBunching]);

    if (!data || data.alerts.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.1 }}
        >
            <div className="glass p-3">
                {/* Header */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between mb-2"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm">⚡</span>
                        <span
                            className="text-xs font-semibold tracking-wider"
                            style={{ color: "var(--text-primary)" }}
                        >
                            BUNCHING ALERTS
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className="tabular-nums text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{
                                background: SEVERITY_BG[data.alerts[0]?.severity || "mild"],
                                color: SEVERITY_COLORS[data.alerts[0]?.severity || "mild"],
                            }}
                        >
                            {data.summary.routes_affected}
                        </span>
                        <span
                            className="text-[10px]"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            {expanded ? "▲" : "▼"}
                        </span>
                    </div>
                </button>

                {/* Summary */}
                <div
                    className="text-[10px] mb-2"
                    style={{ color: "var(--text-tertiary)" }}
                >
                    {data.summary.total_pairs} bunched pair{data.summary.total_pairs !== 1 ? "s" : ""} across{" "}
                    {data.summary.routes_affected} route{data.summary.routes_affected !== 1 ? "s" : ""}
                </div>

                {/* Alert list */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div
                                className="space-y-1.5 max-h-40 overflow-y-auto pt-2"
                                style={{
                                    borderTop:
                                        "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                {data.alerts.slice(0, 10).map((alert) => (
                                    <div
                                        key={alert.route_id}
                                        className="glass-nested px-2.5 py-2"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="text-[10px] font-bold"
                                                    style={{
                                                        color: "#00A8B5",
                                                    }}
                                                >
                                                    {alert.route_short_name}
                                                </span>
                                                <span
                                                    className="text-[8px] px-1 py-0.5 rounded font-semibold tracking-wider"
                                                    style={{
                                                        background: SEVERITY_BG[alert.severity],
                                                        color: SEVERITY_COLORS[alert.severity],
                                                    }}
                                                >
                                                    {alert.severity.toUpperCase()}
                                                </span>
                                            </div>
                                            <span
                                                className="text-[9px] tabular-nums"
                                                style={{
                                                    color: "var(--text-secondary)",
                                                }}
                                            >
                                                {Math.round(
                                                    alert.worst_distance_m
                                                )}
                                                m
                                            </span>
                                        </div>
                                        <div
                                            className="text-[9px]"
                                            style={{
                                                color: "var(--text-tertiary)",
                                            }}
                                        >
                                            {alert.pair_count} pair{alert.pair_count !== 1 ? "s" : ""}{" "}
                                            · closest{" "}
                                            {Math.round(
                                                alert.worst_distance_m
                                            )}
                                            m apart
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
