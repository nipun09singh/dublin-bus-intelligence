"use client";

import { motion } from "framer-motion";

interface PulseRingProps {
    busCount: number;
}

/**
 * PulseRing — top-left glass panel showing live bus count.
 *
 * Glows brighter as the network gets busier.
 * The ring pulses outward continuously — the city's heartbeat.
 */
export default function PulseRing({ busCount }: PulseRingProps) {
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
            <div className="glass relative flex items-center gap-3 px-5 py-4">
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

                {/* Counter */}
                <div className="flex flex-col">
                    <span
                        className="tabular-nums text-xl font-bold leading-tight"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {busCount.toLocaleString()}
                    </span>
                    <span
                        className="text-xs font-medium uppercase tracking-wider"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        buses active
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
