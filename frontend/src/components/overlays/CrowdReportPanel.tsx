"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBusStore } from "@/lib/store";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const CROWDING_OPTIONS = [
    { level: "empty", emoji: "🟢", label: "Empty", description: "Plenty of seats" },
    { level: "seats", emoji: "🟡", label: "Seats", description: "Some seats left" },
    { level: "standing", emoji: "🟠", label: "Standing", description: "Standing room only" },
    { level: "full", emoji: "🔴", label: "Full", description: "Can't board" },
] as const;

type CrowdLevel = (typeof CROWDING_OPTIONS)[number]["level"];

/**
 * CrowdReportPanel — one-tap crowding report for collaboration mode.
 *
 * When a bus is selected in 'collab' mode, this panel appears
 * with 4 crowding buttons. Tap to report. Ripple animation on submit.
 * Reports are POSTed to /api/v1/crowding/report and streamed via WebSocket.
 */
export default function CrowdReportPanel() {
    const vehicle = useBusStore((s) => s.selectedVehicle);
    const [submitted, setSubmitted] = useState<CrowdLevel | null>(null);
    const [rippleKey, setRippleKey] = useState(0);

    const handleReport = useCallback(
        async (level: CrowdLevel) => {
            if (!vehicle) return;
            setRippleKey((k) => k + 1);

            // POST to the crowd report API
            try {
                const resp = await fetch(`${API_URL}/crowding/report`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        vehicle_id: vehicle.vehicle_id,
                        route_id: vehicle.route_id,
                        route_short_name: vehicle.route_short_name,
                        crowding_level: level,
                        latitude: vehicle.latitude,
                        longitude: vehicle.longitude,
                    }),
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                setSubmitted(level);
            } catch (err) {
                console.error("[BusIQ] Failed to submit crowd report", err);
            }

            // Reset after feedback animation
            setTimeout(() => setSubmitted(null), 2500);
        },
        [vehicle]
    );

    if (!vehicle) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40"
        >
            <div className="glass p-4 w-[340px]">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">🤝</span>
                    <span
                        className="text-xs font-semibold tracking-wider"
                        style={{ color: "var(--text-primary)" }}
                    >
                        HOW CROWDED IS ROUTE {vehicle.route_short_name}?
                    </span>
                </div>

                {/* Bus info */}
                <div
                    className="text-[10px] mb-3 px-2"
                    style={{ color: "var(--text-tertiary)" }}
                >
                    Bus #{vehicle.vehicle_id} · Tap to report
                </div>

                {/* Crowding buttons */}
                <div className="grid grid-cols-4 gap-2 relative">
                    {CROWDING_OPTIONS.map((opt) => {
                        const isSelected = submitted === opt.level;
                        return (
                            <button
                                key={opt.level}
                                onClick={() => handleReport(opt.level)}
                                disabled={submitted !== null}
                                className="relative flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-200 overflow-hidden"
                                style={{
                                    background: isSelected
                                        ? "rgba(0, 168, 181, 0.15)"
                                        : "rgba(255,255,255,0.04)",
                                    border: isSelected
                                        ? "1px solid rgba(0, 168, 181, 0.4)"
                                        : "1px solid rgba(255,255,255,0.06)",
                                    opacity: submitted && !isSelected ? 0.3 : 1,
                                }}
                            >
                                {/* Ripple effect on selection */}
                                {isSelected && (
                                    <span
                                        key={rippleKey}
                                        className="absolute inset-0 flex items-center justify-center"
                                    >
                                        <span
                                            className="absolute w-4 h-4 rounded-full animate-ripple"
                                            style={{
                                                backgroundColor:
                                                    "rgba(0, 168, 181, 0.3)",
                                            }}
                                        />
                                    </span>
                                )}

                                <span className="text-xl">{opt.emoji}</span>
                                <span
                                    className="text-[10px] font-semibold tracking-wider"
                                    style={{
                                        color: isSelected
                                            ? "var(--text-primary)"
                                            : "var(--text-secondary)",
                                    }}
                                >
                                    {opt.label.toUpperCase()}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Feedback message */}
                <AnimatePresence>
                    {submitted && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 text-center"
                        >
                            <div className="glass-nested px-3 py-2 rounded-lg">
                                <span
                                    className="text-xs font-medium"
                                    style={{ color: "var(--data-success)" }}
                                >
                                    ✓ Report submitted — thank you!
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
