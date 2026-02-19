"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useBusStore } from "@/lib/store";

/**
 * PulseRing — top-left glass panel showing live fleet stats.
 *
 * Glows brighter as the network gets busier.
 * The ring pulses outward continuously — the city's heartbeat.
 * Shows: bus count, on-time %, avg delay.
 */
export default function PulseRing({ busCount }: { busCount: number }) {
    const vehicles = useBusStore((s) => s.vehicles);

    // Compute fleet stats
    const stats = useMemo(() => {
        if (vehicles.length === 0) return { onTimePercent: 0, avgDelay: 0, delayed: 0 };

        let onTime = 0;
        let totalDelay = 0;
        let delayed = 0;

        for (const v of vehicles) {
            totalDelay += v.delay_seconds;
            if (v.delay_seconds <= 120) {
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

    // Brightness scales with fleet activity (0 = dead, 1100 = full fleet)
    const intensity = Math.min(busCount / 1100, 1);
    const glowOpacity = 0.3 + intensity * 0.5;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute top-6 left-6 z-50"
        >
            <div className="glass p-4">
                {/* Main counter row */}
                <div className="flex items-center gap-3 mb-3">
                    {/* Animated pulse ring */}
                    <div className="relative flex items-center justify-center">
                        <div
                            className="absolute h-8 w-8 rounded-full animate-pulse-ring"
                            style={{
                                backgroundColor: `rgba(0, 168, 181, ${glowOpacity})`,
                            }}
                        />
                        <div
                            className="h-3 w-3 rounded-full"
                            style={{
                                backgroundColor: "var(--busiq-teal-glow)",
                                boxShadow: `0 0 ${8 + intensity * 12}px rgba(0, 168, 181, ${glowOpacity})`,
                            }}
                        />
                    </div>

                    {/* Bus count */}
                    <div className="flex flex-col">
                        <span
                            className="tabular-nums text-2xl font-bold leading-tight"
                            style={{ color: "var(--text-primary)" }}
                        >
                            {busCount.toLocaleString()}
                        </span>
                        <span
                            className="text-[10px] font-medium uppercase tracking-wider"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            buses active
                        </span>
                    </div>
                </div>

                {/* Stats row */}
                {busCount > 0 && (
                    <div
                        className="flex items-center gap-3 pt-3"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                    >
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
                            value={`${stats.avgDelay}m`}
                            label="AVG DELAY"
                            color="var(--text-secondary)"
                        />
                        <MiniStat
                            value={`${stats.delayed}`}
                            label="DELAYED"
                            color="var(--data-hot)"
                        />
                    </div>
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
