"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useBusStore } from "@/lib/store";
import { formatDelay, getDelayStatus } from "@/lib/types";

const DELAY_COLORS: Record<string, string> = {
    "on-time": "#00A8B5",
    slight: "#D4A843",
    moderate: "#E67E22",
    severe: "#C93545",
};

const DELAY_LABELS: Record<string, string> = {
    "on-time": "ON TIME",
    slight: "SLIGHT DELAY",
    moderate: "DELAYED",
    severe: "SEVERELY DELAYED",
};

const OCCUPANCY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
    EMPTY: { icon: "🟢", label: "Empty", color: "#00E676" },
    MANY_SEATS_AVAILABLE: { icon: "🟢", label: "Many seats", color: "#00E676" },
    FEW_SEATS_AVAILABLE: { icon: "🟡", label: "Few seats", color: "#FFD600" },
    STANDING_ROOM_ONLY: { icon: "🟠", label: "Standing only", color: "#FF9800" },
    CRUSHED_STANDING_ROOM_ONLY: { icon: "🔴", label: "Very full", color: "#E53935" },
    FULL: { icon: "🔴", label: "Full", color: "#E53935" },
    NOT_ACCEPTING_PASSENGERS: { icon: "⛔", label: "Not boarding", color: "#C93545" },
    UNKNOWN: { icon: "⚪", label: "Unknown", color: "rgba(255,255,255,0.3)" },
};

/**
 * VehicleInfoCard — glass card showing selected bus details.
 *
 * Appears when a bus marker is clicked on the map.
 * Shows: route name, delay, speed, vehicle ID, occupancy.
 * Glass Rail design: translucent dark panel, 16px radius.
 */
export default function VehicleInfoCard() {
    const vehicle = useBusStore((s) => s.selectedVehicle);
    const selectVehicle = useBusStore((s) => s.selectVehicle);

    const status = vehicle ? getDelayStatus(vehicle.delay_seconds) : "on-time";
    const statusColor = DELAY_COLORS[status];
    const statusLabel = DELAY_LABELS[status];

    const ageSeconds = vehicle
        ? Math.round((Date.now() - new Date(vehicle.timestamp).getTime()) / 1000)
        : 0;
    const ageDisplay =
        ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.round(ageSeconds / 60)}m ago`;

    return (
        <AnimatePresence>
            {!vehicle && (
                <div className="glass p-3 text-center">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                        Click a bus for details
                    </span>
                </div>
            )}
            {vehicle && (
                <motion.div
                    key={vehicle.vehicle_id}
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="z-50"
                >
                    <div className="glass p-4">
                        {/* Header: Route + Close */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {/* Route badge */}
                                <div
                                    className="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg"
                                    style={{
                                        background: "rgba(0, 168, 181, 0.15)",
                                        border: "1px solid rgba(0, 168, 181, 0.3)",
                                        color: "#00A8B5",
                                    }}
                                >
                                    {vehicle.route_short_name || "?"}
                                </div>
                                <div>
                                    <div
                                        className="text-sm font-semibold"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        Route {vehicle.route_short_name || vehicle.route_id}
                                    </div>
                                    <div
                                        className="text-xs"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        Bus #{vehicle.vehicle_id}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => selectVehicle(null)}
                                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                                style={{
                                    background: "rgba(255,255,255,0.06)",
                                    color: "var(--text-secondary)",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Status bar */}
                        <div
                            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
                            style={{
                                background: `${statusColor}15`,
                                border: `1px solid ${statusColor}30`,
                            }}
                        >
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ background: statusColor }}
                            />
                            <span
                                className="text-xs font-semibold tracking-wider"
                                style={{ color: statusColor }}
                            >
                                {statusLabel}
                            </span>
                            <span
                                className="text-xs ml-auto"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                {formatDelay(vehicle.delay_seconds)}
                            </span>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-3 gap-2">
                            <StatCell
                                label="SPEED"
                                value={
                                    vehicle.speed_kmh != null
                                        ? `${Math.round(vehicle.speed_kmh)}`
                                        : "—"
                                }
                                unit="km/h"
                            />
                            <StatCell
                                label="DELAY"
                                value={
                                    vehicle.delay_seconds !== 0
                                        ? `${Math.round(vehicle.delay_seconds / 60)}`
                                        : "0"
                                }
                                unit="min"
                            />
                            <StatCell label="DATA AGE" value={ageDisplay} />
                        </div>

                        {/* Occupancy indicator */}
                        {(() => {
                            const occ = OCCUPANCY_CONFIG[vehicle.occupancy_status] || OCCUPANCY_CONFIG.UNKNOWN;
                            if (vehicle.occupancy_status === "UNKNOWN") return null;
                            return (
                                <div
                                    className="flex items-center gap-2 mt-3 pt-3"
                                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                                >
                                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>CROWDING</div>
                                    <span className="text-xs">{occ.icon}</span>
                                    <span className="text-xs font-medium" style={{ color: occ.color }}>{occ.label}</span>
                                </div>
                            );
                        })()}

                        {/* Bearing indicator */}
                        {vehicle.bearing != null && (
                            <div
                                className="flex items-center gap-2 mt-3 pt-3"
                                style={{
                                    borderTop: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div
                                    className="text-xs"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    HEADING
                                </div>
                                <div
                                    className="text-xs font-mono"
                                    style={{
                                        color: "var(--text-secondary)",
                                        transform: `rotate(${vehicle.bearing}deg)`,
                                        display: "inline-block",
                                    }}
                                >
                                    ↑
                                </div>
                                <span
                                    className="text-xs tabular-nums"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {Math.round(vehicle.bearing)}°
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function StatCell({
    label,
    value,
    unit,
}: {
    label: string;
    value: string;
    unit?: string;
}) {
    return (
        <div className="glass-nested px-2.5 py-2 text-center">
            <div
                className="text-[10px] font-medium tracking-wider mb-0.5"
                style={{ color: "var(--text-tertiary)" }}
            >
                {label}
            </div>
            <div className="flex items-baseline justify-center gap-0.5">
                <span
                    className="tabular-nums text-base font-bold"
                    style={{ color: "var(--text-primary)" }}
                >
                    {value}
                </span>
                {unit && (
                    <span
                        className="text-[10px]"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
}
