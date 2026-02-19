"use client";

/**
 * CarbonBadge — floating glass badge showing CO₂ savings vs. driving.
 *
 * Design doc: "A persistent floating badge shows 'This journey saves 2.3kg CO₂
 * vs. driving' with a tiny leaf animation."
 *
 * Position: bottom-right, above the pillar rail.
 */

interface CarbonBadgeProps {
    savingsKg: number;
    savingsPercent: number;
}

export default function CarbonBadge({
    savingsKg,
    savingsPercent,
}: CarbonBadgeProps) {
    if (savingsKg <= 0) return null;

    return (
        <div className="absolute bottom-24 right-4 z-40 glass rounded-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-right-4">
            {/* Leaf animation */}
            <div className="relative">
                <span className="text-2xl animate-bounce" style={{ animationDuration: "2s" }}>
                    🌿
                </span>
            </div>

            <div>
                <div
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: "#76B82A" }}
                >
                    {savingsKg}kg CO₂ saved
                </div>
                <div
                    className="text-[10px] tabular-nums"
                    style={{ color: "var(--text-tertiary)" }}
                >
                    {savingsPercent}% less than driving
                </div>
            </div>
        </div>
    );
}
