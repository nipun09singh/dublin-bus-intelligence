"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * SentimentAurora — a soft gradient wash across the top of the screen
 * that reflects aggregate passenger sentiment.
 *
 * Green (#2ecc71) = happy network, few crowd reports
 * Amber (#f39c12) = stressed, moderate crowd reports
 * Red   (#e74c3c) = crisis, heavy crowding reported
 *
 * Design doc Section 5.1.3: "Like a mood ring for the city."
 */

interface SentimentData {
    score: number;       // 0 (happy) → 3 (crisis)
    reportCount: number;
    label: string;
}

function scoreTo(score: number): { color1: string; color2: string; label: string; opacity: number } {
    if (score <= 0.5) return { color1: "#2ecc71", color2: "#27ae60", label: "CALM", opacity: 0.12 };
    if (score <= 1.0) return { color1: "#3498db", color2: "#2ecc71", label: "NORMAL", opacity: 0.15 };
    if (score <= 1.5) return { color1: "#f1c40f", color2: "#f39c12", label: "BUSY", opacity: 0.18 };
    if (score <= 2.0) return { color1: "#e67e22", color2: "#d35400", label: "STRESSED", opacity: 0.22 };
    if (score <= 2.5) return { color1: "#e74c3c", color2: "#e67e22", label: "STRAINED", opacity: 0.25 };
    return { color1: "#c0392b", color2: "#e74c3c", label: "CRISIS", opacity: 0.3 };
}

export default function SentimentAurora() {
    const [sentiment, setSentiment] = useState<SentimentData>({ score: 0, reportCount: 0, label: "CALM" });
    const [phase, setPhase] = useState(0);

    const fetchSentiment = useCallback(async () => {
        try {
            const resp = await fetch(`${API_URL}/crowding/snapshot`);
            if (!resp.ok) return;
            const json = await resp.json();
            const data = json.data;
            const summaries = data.route_summaries || [];
            const total = data.total_reports || 0;

            if (summaries.length === 0) {
                setSentiment({ score: 0, reportCount: total, label: "CALM" });
                return;
            }

            // Weighted average score across all routes
            let weightedSum = 0;
            let weightCount = 0;
            for (const s of summaries) {
                weightedSum += (s.avg_score || 0) * (s.report_count || 1);
                weightCount += s.report_count || 1;
            }
            const avgScore = weightCount > 0 ? weightedSum / weightCount : 0;
            const { label } = scoreTo(avgScore);
            setSentiment({ score: avgScore, reportCount: total, label });
        } catch {
            /* graceful silence */
        }
    }, []);

    useEffect(() => {
        fetchSentiment();
        const interval = setInterval(fetchSentiment, 20_000);
        return () => clearInterval(interval);
    }, [fetchSentiment]);

    // Slow aurora phase animation
    useEffect(() => {
        let raf: number;
        let start = performance.now();
        const animate = (now: number) => {
            const elapsed = (now - start) / 1000;
            setPhase(elapsed * 0.15); // slow undulation
            raf = requestAnimationFrame(animate);
        };
        raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
    }, []);

    const visual = useMemo(() => scoreTo(sentiment.score), [sentiment.score]);

    // Create a subtle shifting gradient using phase
    const offset1 = 30 + Math.sin(phase) * 20;
    const offset2 = 70 + Math.cos(phase * 0.7) * 20;

    return (
        <div className="absolute inset-x-0 top-0 z-20 pointer-events-none" style={{ height: "120px" }}>
            {/* Aurora gradient */}
            <div
                className="w-full h-full transition-all duration-[3000ms] ease-in-out"
                style={{
                    background: `linear-gradient(180deg, 
            ${visual.color1}${Math.round(visual.opacity * 255).toString(16).padStart(2, "0")} ${offset1}%, 
            ${visual.color2}${Math.round(visual.opacity * 0.5 * 255).toString(16).padStart(2, "0")} ${offset2}%, 
            transparent 100%)`,
                }}
            />

            {/* Label badge — subtle, top-center */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto">
                <div
                    className="glass px-3 py-1.5 flex items-center gap-2"
                    style={{ background: "rgba(0,0,0,0.5)", borderRadius: "20px" }}
                >
                    <div
                        className="h-2 w-2 rounded-full animate-pulse"
                        style={{ backgroundColor: visual.color1, boxShadow: `0 0 6px ${visual.color1}` }}
                    />
                    <span
                        className="text-[10px] font-semibold tracking-[0.15em]"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        NETWORK {sentiment.label}
                    </span>
                    {sentiment.reportCount > 0 && (
                        <span className="text-[9px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                            · {sentiment.reportCount.toLocaleString()} reports
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
