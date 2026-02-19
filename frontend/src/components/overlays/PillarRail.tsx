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
 * Active pillar shows icon, label, and a brief description.
 */
export default function PillarRail({ activeMode, onModeChange }: PillarRailProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-auto sm:bottom-6"
        >
            <div className="glass flex items-stretch gap-0 px-1 py-1 overflow-x-auto">
                {PILLARS.map((pillar) => {
                    const isActive = activeMode === pillar.id;
                    return (
                        <button
                            key={pillar.id}
                            onClick={() => onModeChange(pillar.id)}
                            className="relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl transition-all duration-200 min-w-0 flex-shrink-0 cursor-pointer"
                            style={{
                                background: isActive ? "rgba(255, 255, 255, 0.06)" : "transparent",
                            }}
                            title={pillar.description}
                        >
                            {/* Icon */}
                            <span className={`text-sm transition-opacity ${isActive ? "opacity-80" : "opacity-30"}`}>
                                {pillar.icon}
                            </span>

                            {/* Text */}
                            <div className="flex flex-col items-start">
                                <span
                                    className="text-[10px] sm:text-[11px] font-semibold tracking-wider whitespace-nowrap transition-colors duration-200"
                                    style={{
                                        color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                                    }}
                                >
                                    {pillar.shortLabel}
                                </span>
                                {isActive && (
                                    <motion.span
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="text-[8px] sm:text-[9px] whitespace-nowrap"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        {pillar.description}
                                    </motion.span>
                                )}
                            </div>

                            {/* Active indicator line */}
                            {isActive && (
                                <motion.div
                                    layoutId="pillar-indicator"
                                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                                    style={{
                                        backgroundColor: "var(--busiq-teal-glow)",
                                        boxShadow: "0 0 8px rgba(0, 168, 181, 0.5)",
                                    }}
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </motion.div>
    );
}
