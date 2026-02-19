"use client";

import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Mode colours from design doc Section 5.1.4 */
const MODE_COLOURS: Record<string, string> = {
    bus: "#00808B",
    luas: "#6B2D8B",
    dart: "#0072CE",
    bike: "#76B82A",
    walk: "#8C8C8C",
};

const MODE_ICONS: Record<string, string> = {
    bus: "🚌",
    luas: "🚊",
    dart: "🚆",
    bike: "🚲",
    walk: "🚶",
};

interface JourneySegment {
    mode: string;
    from_name: string;
    from_lat: number;
    from_lon: number;
    to_name: string;
    to_lat: number;
    to_lon: number;
    distance_km: number;
    duration_minutes: number;
    colour: string;
    details: string;
    real_time_minutes: number | null;
}

interface CarbonResult {
    journey_co2_grams: number;
    car_co2_grams: number;
    savings_grams: number;
    savings_percent: number;
    savings_kg: number;
    equivalent_trees_day: number;
}

interface JourneyOption {
    label: string;
    total_distance_km: number;
    total_duration_minutes: number;
    carbon: CarbonResult | null;
    segments: JourneySegment[];
}

// Popular Dublin locations for quick selection
const PRESET_LOCATIONS = [
    { name: "Phibsborough", lat: 53.3585, lon: -6.2720 },
    { name: "Grand Canal Dock", lat: 53.3388, lon: -6.2380 },
    { name: "Temple Bar", lat: 53.3456, lon: -6.2633 },
    { name: "Connolly Station", lat: 53.3522, lon: -6.2499 },
    { name: "Heuston Station", lat: 53.3465, lon: -6.2929 },
    { name: "St Stephen's Green", lat: 53.3390, lon: -6.2610 },
    { name: "Dundrum", lat: 53.2970, lon: -6.2370 },
    { name: "Howth", lat: 53.3882, lon: -6.0655 },
    { name: "Dún Laoghaire", lat: 53.2948, lon: -6.1350 },
    { name: "Dublin Airport", lat: 53.4264, lon: -6.2499 },
];

interface JourneyPlannerProps {
    onJourneyPlanned: (options: JourneyOption[], selectedIdx: number) => void;
    onClear: () => void;
}

export default function JourneyPlanner({
    onJourneyPlanned,
    onClear,
}: JourneyPlannerProps) {
    const [originIdx, setOriginIdx] = useState(0); // Phibsborough
    const [destIdx, setDestIdx] = useState(1); // Grand Canal Dock
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<JourneyOption[]>([]);
    const [selectedOption, setSelectedOption] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const handlePlan = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const origin = PRESET_LOCATIONS[originIdx];
            const dest = PRESET_LOCATIONS[destIdx];

            const resp = await fetch(`${API_URL}/api/v1/journey/plan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    origin_lat: origin.lat,
                    origin_lon: origin.lon,
                    dest_lat: dest.lat,
                    dest_lon: dest.lon,
                    origin_name: origin.name,
                    dest_name: dest.name,
                }),
            });
            const json = await resp.json();
            const journeyOptions: JourneyOption[] = json.data || [];
            setOptions(journeyOptions);
            setSelectedOption(0);
            if (journeyOptions.length > 0) {
                onJourneyPlanned(journeyOptions, 0);
            }
        } catch (e) {
            setError("Failed to plan journey");
        } finally {
            setLoading(false);
        }
    }, [originIdx, destIdx, onJourneyPlanned]);

    const handleSelectOption = useCallback(
        (idx: number) => {
            setSelectedOption(idx);
            if (options.length > idx) {
                onJourneyPlanned(options, idx);
            }
        },
        [options, onJourneyPlanned]
    );

    const handleClear = useCallback(() => {
        setOptions([]);
        setSelectedOption(0);
        onClear();
    }, [onClear]);

    return (
        <div className="absolute top-36 left-4 z-40 w-[340px]">
            {/* ─── Journey Input Panel ─── */}
            <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3
                        className="text-sm font-semibold tracking-wider uppercase"
                        style={{ color: "var(--text-primary)" }}
                    >
                        🏙️ Journey Planner
                    </h3>
                    {options.length > 0 && (
                        <button
                            onClick={handleClear}
                            className="text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Origin selector */}
                <div>
                    <label
                        className="text-xs uppercase tracking-wide mb-1 block"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        From
                    </label>
                    <select
                        value={originIdx}
                        onChange={(e) => setOriginIdx(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30 transition-colors"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {PRESET_LOCATIONS.map((loc, i) => (
                            <option key={i} value={i} style={{ background: "#1a1a2e" }}>
                                {loc.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Swap button */}
                <div className="flex justify-center">
                    <button
                        onClick={() => {
                            setOriginIdx(destIdx);
                            setDestIdx(originIdx);
                        }}
                        className="text-xs px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        ↕ Swap
                    </button>
                </div>

                {/* Destination selector */}
                <div>
                    <label
                        className="text-xs uppercase tracking-wide mb-1 block"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        To
                    </label>
                    <select
                        value={destIdx}
                        onChange={(e) => setDestIdx(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30 transition-colors"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {PRESET_LOCATIONS.map((loc, i) => (
                            <option key={i} value={i} style={{ background: "#1a1a2e" }}>
                                {loc.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Plan button */}
                <button
                    onClick={handlePlan}
                    disabled={loading || originIdx === destIdx}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40"
                    style={{
                        background:
                            "linear-gradient(135deg, #00808B 0%, #6B2D8B 100%)",
                        color: "#fff",
                    }}
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin">⏳</span> Planning…
                        </span>
                    ) : (
                        "Leave Now →"
                    )}
                </button>

                {error && (
                    <p className="text-xs text-red-400 text-center">{error}</p>
                )}
            </div>

            {/* ─── Journey Results ─── */}
            {options.length > 0 && (
                <div className="mt-3 space-y-2">
                    {options.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSelectOption(idx)}
                            className={`w-full text-left glass rounded-xl p-3 transition-all duration-300 ${selectedOption === idx
                                    ? "ring-1 ring-white/30 scale-[1.02]"
                                    : "opacity-60 hover:opacity-80"
                                }`}
                        >
                            {/* Option header */}
                            <div className="flex items-center justify-between mb-2">
                                <span
                                    className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                    style={{
                                        background:
                                            idx === 0
                                                ? "rgba(0,128,139,0.3)"
                                                : idx === 1
                                                    ? "rgba(107,45,139,0.3)"
                                                    : "rgba(118,184,42,0.3)",
                                        color:
                                            idx === 0
                                                ? "#00CED1"
                                                : idx === 1
                                                    ? "#B87FD9"
                                                    : "#76B82A",
                                    }}
                                >
                                    {opt.label}
                                </span>
                                <span
                                    className="text-sm font-mono tabular-nums"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {Math.round(opt.total_duration_minutes)} min
                                </span>
                            </div>

                            {/* Segment ribbon */}
                            <div className="flex items-center gap-1.5 mb-2">
                                {opt.segments.map((seg, si) => (
                                    <div
                                        key={si}
                                        className="flex items-center gap-1"
                                    >
                                        <span className="text-xs">
                                            {MODE_ICONS[seg.mode] || "📍"}
                                        </span>
                                        <div
                                            className="h-1 rounded-full"
                                            style={{
                                                width: `${Math.max(16, seg.distance_km * 20)}px`,
                                                background: seg.colour,
                                            }}
                                        />
                                        {seg.real_time_minutes !== null && (
                                            <span
                                                className="text-[10px] font-mono animate-pulse"
                                                style={{
                                                    color: seg.real_time_minutes <= 2
                                                        ? "#f97316"
                                                        : "#22d3ee",
                                                }}
                                            >
                                                {seg.real_time_minutes === 0
                                                    ? "DUE"
                                                    : `${seg.real_time_minutes}m`}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Carbon badge */}
                            {opt.carbon && opt.carbon.savings_kg > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px]">🌿</span>
                                    <span
                                        className="text-[10px] tabular-nums"
                                        style={{ color: "#76B82A" }}
                                    >
                                        Saves {opt.carbon.savings_kg}kg CO₂ vs.
                                        driving
                                    </span>
                                </div>
                            )}

                            {/* Expanded details for selected option */}
                            {selectedOption === idx && (
                                <div className="mt-3 pt-2 border-t border-white/10 space-y-1.5">
                                    {opt.segments.map((seg, si) => (
                                        <div
                                            key={si}
                                            className="flex items-start gap-2 text-xs"
                                        >
                                            <div
                                                className="w-1 h-full min-h-[16px] rounded-full mt-0.5 flex-shrink-0"
                                                style={{
                                                    background: seg.colour,
                                                }}
                                            />
                                            <div className="min-w-0">
                                                <span
                                                    style={{
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {MODE_ICONS[seg.mode]}{" "}
                                                    {seg.details ||
                                                        seg.mode.charAt(0).toUpperCase() + seg.mode.slice(1)}
                                                </span>
                                                <span
                                                    className="ml-2 tabular-nums"
                                                    style={{
                                                        color: "var(--text-tertiary)",
                                                    }}
                                                >
                                                    {Math.round(
                                                        seg.duration_minutes
                                                    )}
                                                    min · {seg.distance_km}km
                                                </span>
                                                <div
                                                    className="text-[10px]"
                                                    style={{
                                                        color: "var(--text-tertiary)",
                                                    }}
                                                >
                                                    {seg.from_name} →{" "}
                                                    {seg.to_name}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
