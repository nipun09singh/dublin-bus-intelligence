"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface CrowdReport {
    id: string;
    vehicle_id: string;
    route_id: string;
    route_short_name: string;
    crowding_level: string;
    latitude: number;
    longitude: number;
    reported_at: string;
}

const LEVEL_EMOJI: Record<string, string> = {
    empty: "🟢",
    seats: "🟡",
    standing: "🟠",
    full: "🔴",
};

const LEVEL_LABEL: Record<string, string> = {
    empty: "Empty",
    seats: "Seats available",
    standing: "Standing only",
    full: "Can't board",
};

/**
 * CommunityPulse — Phase 4 collaboration feed.
 *
 * Scrolling, real-time feed of anonymised crowd reports.
 * "What Dublin is saying about the bus today."
 * Appears on right side in collab mode.
 */
export default function CommunityPulse() {
    const [reports, setReports] = useState<CrowdReport[]>([]);
    const [totalReports, setTotalReports] = useState(0);
    const [expanded, setExpanded] = useState(true);
    const feedRef = useRef<HTMLDivElement>(null);

    const fetchReports = useCallback(async () => {
        try {
            const resp = await fetch(`${API_URL}/crowding/snapshot`);
            if (!resp.ok) return;
            const json = await resp.json();
            setReports(json.data.recent_reports || []);
            setTotalReports(json.data.total_reports || 0);
        } catch {
            // Silently fail
        }
    }, []);

    useEffect(() => {
        fetchReports();
        const interval = setInterval(fetchReports, 15000);
        return () => clearInterval(interval);
    }, [fetchReports]);

    const formatAge = (timestamp: string) => {
        const age = Math.round(
            (Date.now() - new Date(timestamp).getTime()) / 1000
        );
        if (age < 60) return `${age}s ago`;
        if (age < 3600) return `${Math.round(age / 60)}m ago`;
        return `${Math.round(age / 3600)}h ago`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute top-36 sm:top-40 right-4 sm:right-6 z-40 w-64 sm:w-72"
        >
            <div className="glass p-3">
                {/* Header */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between mb-2"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm">💬</span>
                        <span
                            className="text-xs font-semibold tracking-wider"
                            style={{ color: "var(--text-primary)" }}
                        >
                            COMMUNITY PULSE
                        </span>
                    </div>
                    <span
                        className="text-[10px]"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {expanded ? "▲" : "▼"}
                    </span>
                </button>

                {/* Impact counter */}
                <div
                    className="flex items-center gap-2 mb-2 text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                >
                    <span
                        className="tabular-nums font-bold"
                        style={{ color: "var(--data-success)" }}
                    >
                        {totalReports.toLocaleString()}
                    </span>{" "}
                    reports from Dublin passengers
                </div>

                {/* Feed */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div
                                ref={feedRef}
                                className="space-y-1.5 max-h-52 overflow-y-auto pt-2"
                                style={{
                                    borderTop:
                                        "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                {reports.length === 0 ? (
                                    <div
                                        className="text-center py-4 text-[10px]"
                                        style={{
                                            color: "var(--text-tertiary)",
                                        }}
                                    >
                                        No reports yet.
                                        <br />
                                        Select a bus in COLLAB mode to report
                                        crowding!
                                    </div>
                                ) : (
                                    reports.map((report, idx) => (
                                        <motion.div
                                            key={report.id}
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="glass-nested px-2.5 py-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs">
                                                        {LEVEL_EMOJI[
                                                            report.crowding_level
                                                        ] || "❓"}
                                                    </span>
                                                    <span
                                                        className="text-[10px] font-semibold"
                                                        style={{
                                                            color: "var(--text-primary)",
                                                        }}
                                                    >
                                                        {LEVEL_LABEL[
                                                            report.crowding_level
                                                        ] ||
                                                            report.crowding_level}
                                                    </span>
                                                </div>
                                                <span
                                                    className="text-[9px] tabular-nums"
                                                    style={{
                                                        color: "var(--text-tertiary)",
                                                    }}
                                                >
                                                    {formatAge(
                                                        report.reported_at
                                                    )}
                                                </span>
                                            </div>
                                            <div
                                                className="text-[9px] mt-0.5"
                                                style={{
                                                    color: "var(--text-tertiary)",
                                                }}
                                            >
                                                Route{" "}
                                                <span
                                                    style={{
                                                        color: "#00A8B5",
                                                    }}
                                                >
                                                    {report.route_short_name}
                                                </span>{" "}
                                                · Bus #{report.vehicle_id}
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
