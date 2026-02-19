"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBusStore } from "@/lib/store";
import type { StopInfo, StopArrival } from "@/lib/types";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const REFRESH_INTERVAL = 15_000; // 15s

/**
 * StopETAPanel — "When does my bus come?"
 *
 * The single most important feature for a Dubliner standing in the rain.
 * Shows live ETA predictions for all approaching buses at a selected stop.
 * Auto-refreshes every 15 seconds.
 */
export default function StopETAPanel() {
    const selectedStop = useBusStore((s) => s.selectedStop);
    const selectStop = useBusStore((s) => s.selectStop);
    const [arrivals, setArrivals] = useState<StopArrival[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchETAs = useCallback(async (stop: StopInfo) => {
        try {
            setLoading(true);
            setError(null);
            const resp = await fetch(`${API_URL}/predictions/eta/${stop.stop_id}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            setArrivals(json.data.predictions || []);
        } catch (err: any) {
            console.error("[BusIQ] ETA fetch failed:", err);
            setError("Could not load arrivals");
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch on stop selection + auto-refresh
    useEffect(() => {
        if (!selectedStop) {
            setArrivals([]);
            return;
        }
        fetchETAs(selectedStop);
        intervalRef.current = setInterval(() => fetchETAs(selectedStop), REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [selectedStop, fetchETAs]);

    if (!selectedStop) return null;

    return (
        <AnimatePresence>
            <motion.div
                key={selectedStop.stop_id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
                <div className="glass p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div
                                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: "rgba(0, 168, 181, 0.15)", border: "1px solid rgba(0, 168, 181, 0.3)" }}
                            >
                                <span className="text-sm">🚏</span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                    {selectedStop.stop_name}
                                </div>
                                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                                    Next buses arriving
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => selectStop(null)}
                            className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Loading state */}
                    {loading && arrivals.length === 0 && (
                        <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="glass-nested h-12 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    )}

                    {/* Error state */}
                    {error && (
                        <div className="glass-nested p-3 text-center">
                            <span className="text-xs" style={{ color: "#C93545" }}>{error}</span>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && arrivals.length === 0 && (
                        <div className="glass-nested p-4 text-center">
                            <div className="text-2xl mb-1">🌙</div>
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                No buses approaching this stop right now
                            </span>
                        </div>
                    )}

                    {/* Arrivals list */}
                    {arrivals.length > 0 && (
                        <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-hide">
                            {arrivals.slice(0, 8).map((a, idx) => (
                                <ArrivalRow key={`${a.vehicle_id}-${idx}`} arrival={a} />
                            ))}
                        </div>
                    )}

                    {/* Auto-refresh indicator */}
                    {arrivals.length > 0 && (
                        <div className="flex items-center justify-center gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
                            <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                                Live · updates every 15s
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

/** A single bus arrival row */
function ArrivalRow({ arrival }: { arrival: StopArrival }) {
    const etaMin = Math.max(0, Math.round(arrival.eta_minutes));
    const isImminent = etaMin <= 2;
    const isSoon = etaMin <= 5;

    const etaColor = isImminent
        ? "#00E676"  // bright green — RUN!
        : isSoon
            ? "#00A8B5"  // teal — coming soon
            : "var(--text-secondary)"; // neutral

    const etaText = etaMin === 0 ? "DUE" : `${etaMin}`;
    const etaUnit = etaMin === 0 ? "" : "min";

    const delayMin = Math.round(arrival.current_delay_seconds / 60);
    const delayColor =
        delayMin <= 2 ? "#00A8B5" : delayMin <= 5 ? "#D4A843" : "#C93545";

    return (
        <div
            className="glass-nested flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={isImminent ? { border: "1px solid rgba(0, 230, 118, 0.2)" } : {}}
        >
            {/* Route badge */}
            <div
                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{
                    background: "rgba(0, 168, 181, 0.12)",
                    border: "1px solid rgba(0, 168, 181, 0.25)",
                    color: "#00A8B5",
                }}
            >
                {arrival.route_short_name}
            </div>

            {/* Bus info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        Route {arrival.route_short_name}
                    </span>
                    {delayMin > 2 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${delayColor}18`, color: delayColor }}>
                            +{delayMin}m
                        </span>
                    )}
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {arrival.distance_km < 1
                        ? `${Math.round(arrival.distance_km * 1000)}m away`
                        : `${arrival.distance_km.toFixed(1)}km away`}
                    {arrival.speed_kmh > 0 && ` · ${Math.round(arrival.speed_kmh)} km/h`}
                </div>
            </div>

            {/* ETA */}
            <div className="flex-shrink-0 text-right">
                <div className="flex items-baseline gap-0.5 justify-end">
                    <span
                        className="tabular-nums text-xl font-bold"
                        style={{ color: etaColor }}
                    >
                        {etaText}
                    </span>
                    {etaUnit && (
                        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                            {etaUnit}
                        </span>
                    )}
                </div>
                {isImminent && (
                    <span className="text-[9px] font-semibold tracking-wider" style={{ color: "#00E676" }}>
                        {etaMin === 0 ? "NOW" : "ARRIVING"}
                    </span>
                )}
            </div>
        </div>
    );
}
