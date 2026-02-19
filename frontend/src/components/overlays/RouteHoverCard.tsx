"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBusStore } from "@/lib/store";

interface RouteHoverCardProps {
    /** Route ID being hovered (from map feature). */
    routeId: string | null;
    /** Route short name for display. */
    routeName: string | null;
    /** Screen coordinates for positioning. */
    x: number;
    y: number;
}

/**
 * RouteHoverCard — floating glass card that appears on route line hover.
 *
 * Shows: route name/number, bus count on route, on-time %.
 * Follows the cursor position on the map.
 */
export default function RouteHoverCard({
    routeId,
    routeName,
    x,
    y,
}: RouteHoverCardProps) {
    const vehicles = useBusStore((s) => s.vehicles);

    // Compute route-specific stats
    const stats = useMemo(() => {
        if (!routeId) return null;
        const routeVehicles = vehicles.filter((v) => v.route_id === routeId);
        if (routeVehicles.length === 0) return null;

        let onTime = 0;
        let totalDelay = 0;

        for (const v of routeVehicles) {
            totalDelay += v.delay_seconds;
            if (v.delay_seconds <= 120) onTime++;
        }

        return {
            busCount: routeVehicles.length,
            onTimePercent: Math.round((onTime / routeVehicles.length) * 100),
            avgDelay: Math.round(totalDelay / routeVehicles.length / 60),
        };
    }, [routeId, vehicles]);

    return (
        <AnimatePresence>
            {routeId && stats && (
                <motion.div
                    key="route-hover"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.12 }}
                    className="absolute z-50 pointer-events-none"
                    style={{
                        left: x + 16,
                        top: y - 20,
                    }}
                >
                    <div className="glass px-3 py-2.5 min-w-[140px]">
                        {/* Route badge + name */}
                        <div className="flex items-center gap-2 mb-2">
                            <div
                                className="flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-bold"
                                style={{
                                    background: "rgba(0, 168, 181, 0.2)",
                                    border: "1px solid rgba(0, 168, 181, 0.35)",
                                    color: "#00A8B5",
                                }}
                            >
                                {routeName || routeId}
                            </div>
                            <span
                                className="text-[10px] font-medium tracking-wider"
                                style={{ color: "var(--text-tertiary)" }}
                            >
                                ROUTE
                            </span>
                        </div>

                        {/* Quick stats */}
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span
                                    className="tabular-nums text-sm font-bold"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {stats.busCount}
                                </span>
                                <span
                                    className="text-[8px] tracking-wider"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    BUSES
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span
                                    className="tabular-nums text-sm font-bold"
                                    style={{
                                        color:
                                            stats.onTimePercent >= 80
                                                ? "var(--data-success)"
                                                : stats.onTimePercent >= 60
                                                    ? "var(--data-warning)"
                                                    : "var(--data-error)",
                                    }}
                                >
                                    {stats.onTimePercent}%
                                </span>
                                <span
                                    className="text-[8px] tracking-wider"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    ON TIME
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span
                                    className="tabular-nums text-sm font-bold"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {stats.avgDelay}m
                                </span>
                                <span
                                    className="text-[8px] tracking-wider"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    AVG DELAY
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
