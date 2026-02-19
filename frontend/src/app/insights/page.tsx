"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface LiveStats {
    timestamp: string;
    hour: number;
    weekday: string;
    total_vehicles: number;
    active_routes: number;
    on_time: number;
    on_time_pct: number;
    slight_delay: number;
    moderate_delay: number;
    severe_delay: number;
    avg_delay_seconds: number;
    ghost_signal_lost: number;
    ghost_dead_routes: number;
    ghost_rate_pct: number;
    bunching_pairs: number;
    bunching_routes: number;
    bunching_severe: number;
    crowd_reports: number;
    crowd_full_routes: number;
    top_delayed_routes: {
        route: string;
        avg_delay: number;
        vehicles: number;
    }[];
}

interface HealthData {
    score: number;
    grade: string;
    components: Record<string, number>;
}

interface Intervention {
    id: string;
    type: string;
    priority: string;
    headline: string;
    route_name: string;
    target_stop: string;
}

function StatCard({
    label,
    value,
    sub,
    color = "cyan",
    large = false,
}: {
    label: string;
    value: string | number;
    sub?: string;
    color?: string;
    large?: boolean;
}) {
    const colors: Record<string, string> = {
        cyan: "border-cyan-500/30 bg-cyan-500/5",
        red: "border-red-500/30 bg-red-500/5",
        amber: "border-amber-500/30 bg-amber-500/5",
        green: "border-green-500/30 bg-green-500/5",
        purple: "border-purple-500/30 bg-purple-500/5",
    };
    const textColors: Record<string, string> = {
        cyan: "text-cyan-400",
        red: "text-red-400",
        amber: "text-amber-400",
        green: "text-green-400",
        purple: "text-purple-400",
    };
    return (
        <div
            className={`rounded-xl border ${colors[color]} backdrop-blur-sm p-4 ${large ? "col-span-2" : ""}`}
        >
            <div className="text-xs uppercase tracking-wider text-white/40 mb-1">
                {label}
            </div>
            <div className={`${large ? "text-4xl" : "text-2xl"} font-bold ${textColors[color]}`}>
                {value}
            </div>
            {sub && <div className="text-xs text-white/50 mt-1">{sub}</div>}
        </div>
    );
}

function HealthGauge({ score, grade }: { score: number; grade: string }) {
    const color =
        score >= 80
            ? "text-green-400"
            : score >= 60
                ? "text-amber-400"
                : "text-red-400";
    const ring =
        score >= 80
            ? "border-green-500"
            : score >= 60
                ? "border-amber-500"
                : "border-red-500";
    return (
        <div className="flex flex-col items-center">
            <div
                className={`w-32 h-32 rounded-full border-4 ${ring} flex items-center justify-center bg-black/50`}
            >
                <div className="text-center">
                    <div className={`text-3xl font-bold ${color}`}>{score}</div>
                    <div className="text-xs text-white/40">/ 100</div>
                </div>
            </div>
            <div className={`mt-2 text-lg font-bold ${color}`}>Grade {grade}</div>
        </div>
    );
}

function DelayBar({
    route,
    delay,
    vehicles,
    maxDelay,
}: {
    route: string;
    delay: number;
    vehicles: number;
    maxDelay: number;
}) {
    const pct = Math.min((delay / maxDelay) * 100, 100);
    const mins = Math.round(delay / 60);
    return (
        <div className="flex items-center gap-3 mb-2">
            <div className="w-12 text-right font-mono text-sm text-white/70">
                {route}
            </div>
            <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden relative">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    {mins} min avg · {vehicles} buses
                </span>
            </div>
        </div>
    );
}

function InterventionRow({ int: i }: { int: Intervention }) {
    const priorityColor =
        i.priority === "critical"
            ? "bg-red-500/20 text-red-400 border-red-500/30"
            : i.priority === "high"
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
            <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${priorityColor}`}
            >
                {i.priority}
            </span>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/90 truncate">
                    {i.headline}
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                    Route {i.route_name} → {i.target_stop}
                </div>
            </div>
            <span className="text-xs font-mono text-cyan-400/70 whitespace-nowrap">
                {i.type}
            </span>
        </div>
    );
}

export default function InsightsPage() {
    const [live, setLive] = useState<LiveStats | null>(null);
    const [health, setHealth] = useState<HealthData | null>(null);
    const [interventions, setInterventions] = useState<Intervention[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchAll = useCallback(async () => {
        try {
            const [insightsRes, healthRes, intRes] = await Promise.all([
                fetch(`${API_URL}/insights`),
                fetch(`${API_URL}/ops/health`),
                fetch(`${API_URL}/ops/interventions`),
            ]);
            if (insightsRes.ok) {
                const d = await insightsRes.json();
                setLive(d.live);
            }
            if (healthRes.ok) {
                const d = await healthRes.json();
                setHealth(d.data);
            }
            if (intRes.ok) {
                const d = await intRes.json();
                setInterventions(d.data?.interventions?.slice(0, 8) || []);
            }
            setLastRefresh(new Date());
        } catch {
            /* silently retry next cycle */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        if (!autoRefresh) return;
        const id = setInterval(fetchAll, 30_000);
        return () => clearInterval(id);
    }, [fetchAll, autoRefresh]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-cyan-400 text-xl animate-pulse">
                    Loading BusIQ Insights...
                </div>
            </div>
        );
    }

    const maxDelay = Math.max(
        ...(live?.top_delayed_routes?.map((r) => r.avg_delay) || [1]),
    );

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white overflow-y-auto">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-white/40 hover:text-white transition text-sm"
                        >
                            ← Map
                        </Link>
                        <h1 className="text-xl font-bold tracking-tight">
                            <span className="text-cyan-400">BusIQ</span> Insights
                        </h1>
                        <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                            LIVE
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`text-xs px-3 py-1 rounded-full border transition ${autoRefresh
                                    ? "border-cyan-500/30 text-cyan-400 bg-cyan-500/10"
                                    : "border-white/10 text-white/40"
                                }`}
                        >
                            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
                        </button>
                        <button
                            onClick={fetchAll}
                            className="text-xs px-3 py-1 rounded-full border border-white/10 text-white/50 hover:text-white transition"
                        >
                            Refresh
                        </button>
                        <span className="text-xs text-white/30">
                            {lastRefresh.toLocaleTimeString()} ·{" "}
                            {live?.weekday} {live?.hour}:00
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* Hero stats row */}
                <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <StatCard
                        label="Live Vehicles"
                        value={live?.total_vehicles?.toLocaleString() || "—"}
                        sub={`${live?.active_routes || 0} routes`}
                        color="cyan"
                    />
                    <StatCard
                        label="On-Time Rate"
                        value={`${live?.on_time_pct || 0}%`}
                        sub={`${live?.on_time || 0} of ${live?.total_vehicles || 0}`}
                        color={
                            (live?.on_time_pct || 0) >= 80
                                ? "green"
                                : (live?.on_time_pct || 0) >= 60
                                    ? "amber"
                                    : "red"
                        }
                    />
                    <StatCard
                        label="Avg Delay"
                        value={`${((live?.avg_delay_seconds || 0) / 60).toFixed(1)} min`}
                        sub={`${live?.severe_delay || 0} severely delayed`}
                        color="amber"
                    />
                    <StatCard
                        label="Ghost Buses"
                        value={live?.ghost_signal_lost || 0}
                        sub={`${live?.ghost_rate_pct || 0}% of fleet`}
                        color="red"
                    />
                    <StatCard
                        label="Bunching Pairs"
                        value={live?.bunching_pairs || 0}
                        sub={`${live?.bunching_routes || 0} routes · ${live?.bunching_severe || 0} severe`}
                        color="amber"
                    />
                    <StatCard
                        label="Dead Routes"
                        value={live?.ghost_dead_routes || 0}
                        sub="Zero live buses"
                        color="red"
                    />
                </section>

                {/* Network health + Interventions */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Health gauge */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6 flex flex-col items-center">
                        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
                            Network Health
                        </h2>
                        {health ? (
                            <>
                                <HealthGauge
                                    score={health.score}
                                    grade={health.grade}
                                />
                                <div className="mt-4 w-full space-y-2">
                                    {Object.entries(health.components || {}).map(
                                        ([k, v]) => (
                                            <div
                                                key={k}
                                                className="flex justify-between text-xs"
                                            >
                                                <span className="text-white/40 capitalize">
                                                    {k.replace(/_/g, " ")}
                                                </span>
                                                <span
                                                    className={
                                                        v >= 70
                                                            ? "text-green-400"
                                                            : v >= 50
                                                                ? "text-amber-400"
                                                                : "text-red-400"
                                                    }
                                                >
                                                    {Math.round(v)}/100
                                                </span>
                                            </div>
                                        ),
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-white/30">Loading...</div>
                        )}
                    </div>

                    {/* Active interventions */}
                    <div className="lg:col-span-2 rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
                                Active Interventions
                            </h2>
                            <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full">
                                {interventions.length} active
                            </span>
                        </div>
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-2">
                            {interventions.length > 0 ? (
                                interventions.map((i) => (
                                    <InterventionRow key={i.id} int={i} />
                                ))
                            ) : (
                                <div className="text-white/30 text-sm py-8 text-center">
                                    No active interventions
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Worst routes */}
                <section className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6">
                    <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
                        Top 10 Worst-Performing Routes
                    </h2>
                    <div className="space-y-1">
                        {(live?.top_delayed_routes || []).map((r) => (
                            <DelayBar
                                key={r.route}
                                route={r.route}
                                delay={r.avg_delay}
                                vehicles={r.vehicles}
                                maxDelay={maxDelay}
                            />
                        ))}
                    </div>
                </section>

                {/* Delay distribution */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        label="On Time (< 1 min)"
                        value={live?.on_time || 0}
                        color="green"
                    />
                    <StatCard
                        label="Slight (1-3 min)"
                        value={live?.slight_delay || 0}
                        color="cyan"
                    />
                    <StatCard
                        label="Moderate (3-5 min)"
                        value={live?.moderate_delay || 0}
                        color="amber"
                    />
                    <StatCard
                        label="Severe (5+ min)"
                        value={live?.severe_delay || 0}
                        color="red"
                    />
                </section>

                {/* Killer stat callout */}
                <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 p-8 text-center">
                    <div className="text-white/40 text-sm uppercase tracking-wider mb-2">
                        The Killer Stat
                    </div>
                    <div className="text-4xl md:text-5xl font-bold text-cyan-400 mb-3">
                        {live?.ghost_rate_pct || 0}% of the fleet is invisible
                    </div>
                    <div className="text-white/50 max-w-xl mx-auto">
                        {live?.ghost_signal_lost || 0} buses have dropped off the
                        grid. Passengers are waiting at stops for services that
                        will never arrive. BusIQ detects every one — and
                        recommends deploying standby vehicles to cover them.
                    </div>
                </section>

                {/* Footer */}
                <footer className="text-center py-8 text-white/20 text-xs space-y-1">
                    <div>
                        BusIQ — Real-time Operations Intelligence for Dublin Bus
                    </div>
                    <div>
                        Data: NTA GTFS-RT (live) · {live?.total_vehicles || 0}{" "}
                        vehicles · {live?.active_routes || 0} routes ·
                        Updated every 30s
                    </div>
                    <div>Dublin Bus Innovation Challenge 2026</div>
                </footer>
            </main>
        </div>
    );
}
