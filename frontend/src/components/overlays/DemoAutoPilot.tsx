"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PillarMode } from "@/lib/types";

/**
 * DemoAutoPilot — scripted 3-minute judge demo mode.
 *
 * Design doc Section 5.5 choreography:
 *   0:00 — First Load (buses materialize)
 *   0:15 — Data & Viz Mode
 *   0:45 — Optimisation Mode
 *   1:30 — Collaboration Mode
 *   2:00 — Smart Cities Mode
 *   2:45 — Close (zoom out, all buses visible)
 *
 * When active, automatically switches pillar modes at the scripted times
 * and shows a teleprompter overlay with the script for each beat.
 */

interface DemoStep {
    time: number;       // seconds from start
    mode: PillarMode;
    title: string;
    script: string;
    flyTo?: { lat: number; lon: number; zoom: number; pitch?: number; bearing?: number };
}

const DEMO_STEPS: DemoStep[] = [
    {
        time: 0,
        mode: "data-viz",
        title: "FIRST LOAD",
        script: "Full-bleed dark map of Dublin zooms in. Buses materialize as glowing dots along their routes. The Pulse Ring counts up.",
        flyTo: { lat: 53.3498, lon: -6.2603, zoom: 11, pitch: 0, bearing: 0 },
    },
    {
        time: 15,
        mode: "data-viz",
        title: "DATA & VISUALISATION",
        script: "\"This is what Dublin Bus looks like right now. Every 15 seconds, live positions from NTA. Route arteries flowing. Stop heartbeats pulsing.\"",
        flyTo: { lat: 53.3498, lon: -6.2603, zoom: 13, pitch: 45, bearing: -20 },
    },
    {
        time: 45,
        mode: "optimise",
        title: "OPTIMISATION",
        script: "\"Now watch: ghost buses — scheduled but invisible. Bunching — three buses within 400m on the same route. BusIQ sees what passengers can't.\"",
        flyTo: { lat: 53.3550, lon: -6.2700, zoom: 13.5, pitch: 50, bearing: 10 },
    },
    {
        time: 90,
        mode: "collab",
        title: "COLLABORATION",
        script: "\"Turn passengers into sensors. One tap, report crowding. Watch the ripples. The community pulse feed. This is citizen-powered data.\"",
        flyTo: { lat: 53.3498, lon: -6.2603, zoom: 13, pitch: 30, bearing: 0 },
    },
    {
        time: 120,
        mode: "smart-cities",
        title: "SMART CITIES",
        script: "\"Buses don't exist in isolation. Luas. DART. Dublin Bikes. One journey, three modes, real-time. This journey saves 2.1kg of CO₂.\"",
        flyTo: { lat: 53.3480, lon: -6.2500, zoom: 13, pitch: 40, bearing: -15 },
    },
    {
        time: 165,
        mode: "data-viz",
        title: "CLOSE",
        script: "\"One platform. Four pillars. Built on data Dublin Bus already has. Ready to deploy. This is BusIQ.\"",
        flyTo: { lat: 53.3498, lon: -6.2603, zoom: 11.5, pitch: 0, bearing: 0 },
    },
];

const TOTAL_DURATION = 180; // 3 minutes

interface DemoAutoPilotProps {
    active: boolean;
    onModeChange: (mode: PillarMode) => void;
    onFlyTo?: (opts: { lat: number; lon: number; zoom: number; pitch?: number; bearing?: number }) => void;
    onEnd: () => void;
}

export default function DemoAutoPilot({ active, onModeChange, onFlyTo, onEnd }: DemoAutoPilotProps) {
    const [elapsed, setElapsed] = useState(0);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const startRef = useRef<number>(0);
    const lastStepRef = useRef<number>(-1);

    // Timer
    useEffect(() => {
        if (!active) {
            setElapsed(0);
            setCurrentStepIdx(0);
            lastStepRef.current = -1;
            return;
        }

        startRef.current = Date.now();
        const interval = setInterval(() => {
            const now = Date.now();
            const secs = (now - startRef.current) / 1000;
            setElapsed(secs);

            if (secs >= TOTAL_DURATION) {
                clearInterval(interval);
                onEnd();
            }
        }, 200);

        return () => clearInterval(interval);
    }, [active, onEnd]);

    // Step transitions
    useEffect(() => {
        if (!active) return;

        // Find current step
        let stepIdx = 0;
        for (let i = DEMO_STEPS.length - 1; i >= 0; i--) {
            if (elapsed >= DEMO_STEPS[i].time) {
                stepIdx = i;
                break;
            }
        }

        if (stepIdx !== lastStepRef.current) {
            lastStepRef.current = stepIdx;
            setCurrentStepIdx(stepIdx);
            const step = DEMO_STEPS[stepIdx];
            onModeChange(step.mode);
            if (step.flyTo && onFlyTo) onFlyTo(step.flyTo);
        }
    }, [elapsed, active, onModeChange, onFlyTo]);

    if (!active) return null;

    const step = DEMO_STEPS[currentStepIdx];
    const progress = Math.min(elapsed / TOTAL_DURATION, 1);
    const remaining = Math.max(0, Math.ceil(TOTAL_DURATION - elapsed));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 top-0 z-[60] pointer-events-none"
            >
                {/* Progress bar */}
                <div className="w-full h-1 bg-black/40">
                    <motion.div
                        className="h-full"
                        style={{
                            width: `${progress * 100}%`,
                            background: "linear-gradient(90deg, #00808B, #00A8B5, #2ecc71)",
                        }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                {/* Step indicator pills */}
                <div className="flex justify-center gap-1.5 mt-2">
                    {DEMO_STEPS.map((s, i) => (
                        <div
                            key={i}
                            className="h-1 rounded-full transition-all duration-500"
                            style={{
                                width: i === currentStepIdx ? "32px" : "8px",
                                background: i <= currentStepIdx ? "#00A8B5" : "rgba(255,255,255,0.15)",
                            }}
                        />
                    ))}
                </div>

                {/* Teleprompter card — bottom center */}
                <motion.div
                    key={currentStepIdx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-lg pointer-events-auto"
                >
                    <div className="glass p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                <span
                                    className="text-[10px] font-bold tracking-[0.2em]"
                                    style={{ color: "#00A8B5" }}
                                >
                                    DEMO MODE — {step.title}
                                </span>
                            </div>
                            <span className="text-xs tabular-nums font-mono" style={{ color: "var(--text-tertiary)" }}>
                                {minutes}:{seconds.toString().padStart(2, "0")}
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                            {step.script}
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
