"use client";

import { motion } from "framer-motion";
import { PillarMode, PILLARS } from "@/lib/types";

interface PillarRailProps {
    activeMode: PillarMode;
    onModeChange: (mode: PillarMode) => void;
}

/**
 * PillarRail — bottom glass rail for switching between the four DBI pillars.
 *
 * Each pillar transforms the map layers, not the route.
 * Active pillar has a glowing teal indicator dot.
 */
export default function PillarRail({ activeMode, onModeChange }: PillarRailProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-auto sm:bottom-6"
        >
            <div className="glass flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-2 overflow-x-auto">
                {PILLARS.map((pillar) => {
                    const isActive = activeMode === pillar.id;
                    return (
                        <button
                            key={pillar.id}
                            onClick={() => onModeChange(pillar.id)}
                            className="relative flex flex-col items-center gap-1 sm:gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all duration-200 min-w-0 flex-shrink-0"
                            style={{
                                background: isActive ? "rgba(255, 255, 255, 0.06)" : "transparent",
                            }}
                        >
                            {/* Active indicator dot */}
                            <div className="flex items-center justify-center h-2">
                                {isActive && (
                                    <motion.div
                                        layoutId="pillar-indicator"
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{
                                            backgroundColor: "var(--busiq-teal-glow)",
                                            boxShadow: "0 0 8px rgba(0, 168, 181, 0.6)",
                                        }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </div>

                            {/* Label */}
                            <span
                                className="text-[10px] sm:text-xs font-semibold tracking-wider whitespace-nowrap transition-colors duration-200"
                                style={{
                                    color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                                }}
                            >
                                {pillar.shortLabel}
                            </span>
                        </button>
                    );
                })}
            </div>
        </motion.div>
    );
}
