"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useBusStore } from "@/lib/store";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface HealthComponent {
    name: string;
    score: number;
    weight: number;
    weighted: number;
    detail: string;
}

interface NetworkHealth {
    score: number;
    grade: string;
    status: string;
    components: HealthComponent[];
    total_live_vehicles: number;
    total_routes_active: number;
    interventions_pending: number;
}

const GRADE_COLORS: Record<string, string> = {
    A: "#22C55E",
    B: "#84CC16",
    C: "#EAB308",
    D: "#F97316",
    F: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
    excellent: "EXCELLENT",
    good: "GOOD",
    fair: "ATTENTION",
    poor: "POOR",
    crisis: "CRISIS",
};

/**
 * PulseRing — top-left Situational Awareness panel.
 *
 * Shows Network Health Score (0-100) + live fleet stats.
 * Glows based on health score, not just fleet size.
 * The ring colour reflects overall network health.
 */
export default function PulseRing({ busCount }: { busCount: number }) {
    const vehicles = useBusStore((s) => s.vehicles);
    const [health, setHealth] = useState<NetworkHealth | null>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);

    const fetchHealth = useCallback(async () => {
        try {
            const resp = await fetch(`${API_URL}/ops/health`);
            if (!resp.ok) return;
            const json = await resp.json();
            setHealth(json.data);
        } catch {
            // Silently fail
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, [fetchHealth]);

    // Compute fleet stats
    const stats = useMemo(() => {
        if (vehicles.length === 0) return { onTimePercent: 0, avgDelay: 0, delayed: 0 };

        let onTime = 0;
        let totalDelay = 0;
        let delayed = 0;

        for (const v of vehicles) {
            totalDelay += v.delay_seconds;
            if (v.delay_seconds <= 300) {
                onTime++;
            } else {
                delayed++;
            }
        }

        return {
            onTimePercent: Math.round((onTime / vehicles.length) * 100),
            avgDelay: Math.round(totalDelay / vehicles.length / 60),
            delayed,
        };
    }, [vehicles]);

    const score = health?.score ?? 0;
    const grade = health?.grade ?? "—";
    const gradeColor = GRADE_COLORS[grade] || "#6B7280";
    const statusLabel = health ? STATUS_LABELS[health.status] || health.status.toUpperCase() : "LOADING";
    const pendingInterventions = health?.interventions_pending ?? 0;

    // Glow based on health: green = healthy, red = crisis
    const healthHue = Math.round((score / 100) * 120); // 0=red, 120=green
    const glowColor = `hsl(${healthHue}, 80%, 50%)`;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            <div className="glass p-3 sm:p-4">
                {/* Health Score Row */}
                <div className="flex items-center gap-3 mb-2">
                    {/* Animated health ring */}
                    <div className="relative flex items-center justify-center">
                        <div
                            className="absolute h-12 w-12 rounded-full animate-pulse-ring"
                            style={{
                                backgroundColor: `${glowColor}40`,
                            }}
                        />
                        <div
                            className="h-10 w-10 rounded-full flex items-center justify-center"
                            style={{
                                border: `2px solid ${gradeColor}`,
                                boxShadow: `0 0 12px ${gradeColor}40`,
                            }}
                        >
                            <span
                                className="tabular-nums text-sm font-bold"
                                style={{ color: gradeColor }}
                            >
                                {health ? score : "—"}
                            </span>
                        </div>
                    </div>

                    {/* Score label */}
                    <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="text-xs font-bold tracking-wider"
                                style={{ color: gradeColor }}
                            >
                                {statusLabel}
                            </span>
                            {pendingInterventions > 0 && (
                                <span
                                    className="text-[9px] font-bold px-1 py-0.5 rounded-full animate-pulse"
                                    style={{
                                        backgroundColor: "rgba(239, 68, 68, 0.2)",
                                        color: "#EF4444",
                                    }}
                                >
                                    {pendingInterventions} ⚡
                                </span>
                            )}
                        </div>
                        <span
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            Network Health
                        </span>
                    </div>
                </div>

                {/* Fleet count + stats */}
                <div
                    className="flex items-center gap-3 pt-2 mb-1"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                    <MiniStat
                        value={busCount.toLocaleString()}
                        label="ACTIVE"
                        color="var(--text-primary)"
                    />
                    {busCount > 0 && (
                        <>
                            <MiniStat
                                value={`${stats.onTimePercent}%`}
                                label="ON TIME"
                                color={
                                    stats.onTimePercent >= 80
                                        ? "var(--data-success)"
                                        : stats.onTimePercent >= 60
                                            ? "var(--data-warning)"
                                            : "var(--data-error)"
                                }
                            />
                            <MiniStat
                                value={`${stats.delayed}`}
                                label="DELAYED"
                                color="var(--data-hot)"
                            />
                        </>
                    )}
                </div>

                {/* Health component breakdown (expandable) */}
                {health && health.components.length > 0 && (
                    <button
                        onClick={() => setShowBreakdown(!showBreakdown)}
                        className="w-full text-[9px] text-center mt-1 py-0.5 rounded transition-colors hover:bg-white/5"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {showBreakdown ? "Hide breakdown ▲" : "Show breakdown ▼"}
                    </button>
                )}

                {showBreakdown && health && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="mt-2 space-y-1.5"
                    >
                        {health.components.map((comp) => (
                            <div key={comp.name}>
                                <div className="flex items-center justify-between mb-0.5">
                                    <span
                                        className="text-[9px]"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        {comp.name}
                                    </span>
                                    <span
                                        className="text-[9px] tabular-nums font-semibold"
                                        style={{
                                            color:
                                                comp.score >= 75
                                                    ? "#22C55E"
                                                    : comp.score >= 50
                                                        ? "#EAB308"
                                                        : "#EF4444",
                                        }}
                                    >
                                        {Math.round(comp.score)}
                                    </span>
                                </div>
                                <div
                                    className="h-1 rounded-full overflow-hidden"
                                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                                >
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${comp.score}%`,
                                            backgroundColor:
                                                comp.score >= 75
                                                    ? "#22C55E"
                                                    : comp.score >= 50
                                                        ? "#EAB308"
                                                        : "#EF4444",
                                        }}
                                    />
                                </div>
                                <span
                                    className="text-[8px] mt-0.5 block"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    {comp.detail}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

function MiniStat({
    value,
    label,
    color,
}: {
    value: string;
    label: string;
    color: string;
}) {
    return (
        <div className="flex flex-col items-center">
            <span
                className="tabular-nums text-sm font-bold"
                style={{ color }}
            >
                {value}
            </span>
            <span
                className="text-[8px] font-medium tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
            >
                {label}
            </span>
        </div>
    );
}
