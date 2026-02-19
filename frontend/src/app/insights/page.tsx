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
    components: { name: string; score: number; weight: number; weighted: number; detail: string }[];
}

interface Intervention {
    id: string;
    type: string;
    priority: string;
    headline: string;
    route_name: string;
    target_stop: string;
}

/* ─── Reusable Components ─── */

function StatCard({
    label,
    value,
    sub,
    color = "cyan",
    icon,
}: {
    label: string;
    value: string | number;
    sub?: string;
    color?: string;
    icon?: string;
}) {
    const palettes: Record<string, { border: string; bg: string; text: string }> = {
        cyan: { border: "border-cyan-500/20", bg: "bg-cyan-500/[0.04]", text: "text-cyan-400" },
        red: { border: "border-red-500/20", bg: "bg-red-500/[0.04]", text: "text-red-400" },
        amber: { border: "border-amber-500/20", bg: "bg-amber-500/[0.04]", text: "text-amber-400" },
        green: { border: "border-emerald-500/20", bg: "bg-emerald-500/[0.04]", text: "text-emerald-400" },
        purple: { border: "border-purple-500/20", bg: "bg-purple-500/[0.04]", text: "text-purple-400" },
    };
    const p = palettes[color] || palettes.cyan;
    return (
        <div className={`rounded-2xl border ${p.border} ${p.bg} backdrop-blur-sm p-5 transition-all hover:scale-[1.02] hover:border-opacity-40`}>
            <div className="flex items-center gap-2 mb-2">
                {icon && <span className="text-base opacity-60">{icon}</span>}
                <span className="text-[11px] uppercase tracking-widest text-white/35 font-medium">
                    {label}
                </span>
            </div>
            <div className={`text-3xl font-bold tabular-nums ${p.text}`}>
                {value}
            </div>
            {sub && <div className="text-[11px] text-white/40 mt-1.5">{sub}</div>}
        </div>
    );
}

function HealthGauge({ score, grade }: { score: number; grade: string }) {
    const color = score >= 80 ? "#22C55E" : score >= 60 ? "#EAB308" : "#EF4444";
    const textColor = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
    const circumference = 2 * Math.PI * 56;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-36 h-36">
                {/* Background ring */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle
                        cx="64" cy="64" r="56" fill="none"
                        stroke={color} strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold tabular-nums ${textColor}`}>{score}</span>
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">/ 100</span>
                </div>
            </div>
            <div className={`mt-3 text-sm font-bold uppercase tracking-wider ${textColor}`}>
                Grade {grade}
            </div>
        </div>
    );
}

function HealthBar({ name, score, detail }: { name: string; score: number; detail: string }) {
    const color = score >= 75 ? "#22C55E" : score >= 50 ? "#EAB308" : "#EF4444";
    return (
        <div className="group">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/50 font-medium">{name}</span>
                <span className="text-xs tabular-nums font-semibold" style={{ color }}>
                    {Math.round(score)}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(score, 2)}%`, backgroundColor: color }}
                />
            </div>
            <div className="text-[10px] text-white/25 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {detail}
            </div>
        </div>
    );
}

function DelayBar({
    route,
    delay,
    vehicles,
    maxDelay,
    rank,
}: {
    route: string;
    delay: number;
    vehicles: number;
    maxDelay: number;
    rank: number;
}) {
    const pct = Math.min((delay / maxDelay) * 100, 100);
    const mins = (delay / 60).toFixed(1);
    const barColor = delay > 600 ? "from-red-600 to-red-400" : delay > 300 ? "from-amber-600 to-amber-400" : "from-cyan-600 to-cyan-400";
    return (
        <div className="flex items-center gap-3 py-1.5 group">
            <span className="text-[10px] text-white/20 w-4 text-right tabular-nums">{rank}</span>
            <div className="w-12 text-right">
                <span className="font-mono text-sm font-semibold text-white/80">{route}</span>
            </div>
            <div className="flex-1 h-7 bg-white/[0.04] rounded-lg overflow-hidden relative">
                <div
                    className={`h-full rounded-lg bg-gradient-to-r ${barColor} transition-all duration-700`}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-[11px] font-medium text-white/80">
                    {mins} min avg · {vehicles} buses
                </span>
            </div>
        </div>
    );
}

function InterventionRow({ int: i }: { int: Intervention }) {
    const typeIcons: Record<string, string> = { HOLD: "⏸", DEPLOY: "🚌", SURGE: "⚡", EXPRESS: "🏃" };
    const priorityStyles: Record<string, string> = {
        critical: "bg-red-500/15 text-red-400 border-red-500/25",
        high: "bg-amber-500/15 text-amber-400 border-amber-500/25",
        medium: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
        low: "bg-white/5 text-white/40 border-white/10",
    };
    return (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
            <span className="text-base mt-0.5">{typeIcons[i.type] || "📋"}</span>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/85 leading-snug truncate">
                    {i.headline}
                </div>
                <div className="text-[11px] text-white/35 mt-0.5">
                    Route {i.route_name}{i.target_stop ? ` → ${i.target_stop}` : ""}
                </div>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase shrink-0 ${priorityStyles[i.priority] || priorityStyles.medium}`}>
                {i.priority}
            </span>
        </div>
    );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3 opacity-30">{icon}</span>
            <div className="text-sm text-white/40 font-medium">{title}</div>
            <div className="text-xs text-white/25 mt-1 max-w-xs">{sub}</div>
        </div>
    );
}

function ShimmerCard() {
    return (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 animate-pulse">
            <div className="h-3 w-20 bg-white/10 rounded mb-3" />
            <div className="h-8 w-16 bg-white/10 rounded mb-2" />
            <div className="h-2 w-24 bg-white/5 rounded" />
        </div>
    );
}

/* ─── Main Page ─── */

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

    const hasData = live && (live.total_vehicles ?? 0) > 0;
    const maxDelay = Math.max(...(live?.top_delayed_routes?.map((r) => r.avg_delay) || [1]));

    // Smart killer stat — pick the most impactful finding
    const killerStat = (() => {
        if (!hasData) return null;
        const ghostPct = live?.ghost_rate_pct || 0;
        const bunchPairs = live?.bunching_pairs || 0;
        const onTimePct = live?.on_time_pct || 0;
        const severeDelay = live?.severe_delay || 0;

        if (ghostPct >= 5) return {
            value: `${ghostPct}%`,
            label: "of Dublin's bus fleet is invisible right now",
            detail: `${live?.ghost_signal_lost || 0} buses have dropped off the grid. Passengers are waiting at stops for services that will never arrive. BusIQ detects every one — and recommends deploying standby vehicles to cover them.`,
        };
        if (bunchPairs >= 10) return {
            value: `${bunchPairs}`,
            label: "bunching pairs detected across the network",
            detail: `${live?.bunching_routes || 0} routes have buses running too close together, wasting capacity while downstream stops wait. BusIQ generates HOLD interventions to restore even headway.`,
        };
        if (onTimePct < 60) return {
            value: `${onTimePct}%`,
            label: "on-time performance — below acceptable threshold",
            detail: `Only ${live?.on_time || 0} of ${live?.total_vehicles || 0} buses are running on schedule. BusIQ identifies the worst-performing routes and generates EXPRESS skip interventions to recover time.`,
        };
        if (severeDelay > 0) return {
            value: `${severeDelay}`,
            label: "buses are severely delayed (5+ minutes)",
            detail: `These buses are more than 5 minutes behind schedule, impacting thousands of passengers. BusIQ tracks every delay and recommends corrective action.`,
        };
        return {
            value: `${live?.total_vehicles || 0}`,
            label: "buses tracked live across Dublin right now",
            detail: `BusIQ monitors the entire Dublin Bus fleet in real-time — every 15 seconds via NTA GTFS-RT. Health score, ghost detection, bunching alerts, and intervention recommendations, all from one platform.`,
        };
    })();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#06060a]">
                <header className="border-b border-white/5 bg-[#06060a]">
                    <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-4">
                        <div className="h-5 w-5 rounded-full bg-cyan-500/20 animate-pulse" />
                        <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                    </div>
                </header>
                <main className="max-w-7xl mx-auto px-6 py-8">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                        {Array.from({ length: 6 }).map((_, i) => <ShimmerCard key={i} />)}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#06060a] text-white">
            {/* ─── Header ─── */}
            <header className="sticky top-0 z-50 bg-[#06060a]/80 backdrop-blur-2xl border-b border-white/[0.04]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-white/30 hover:text-white/70 transition text-sm flex items-center gap-1.5"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60">
                                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Map
                        </Link>
                        <div className="h-4 w-px bg-white/10" />
                        <h1 className="text-lg font-bold tracking-tight">
                            <span className="text-cyan-400">BusIQ</span>
                            <span className="text-white/60 font-normal ml-1.5">Insights</span>
                        </h1>
                        {hasData && (
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${autoRefresh
                                    ? "border-cyan-500/20 text-cyan-400/80 bg-cyan-500/[0.06]"
                                    : "border-white/[0.06] text-white/30"
                                }`}
                        >
                            {autoRefresh ? "● Auto" : "○ Paused"}
                        </button>
                        <button
                            onClick={fetchAll}
                            className="text-[11px] px-3 py-1.5 rounded-lg border border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/10 transition-all"
                        >
                            ↻ Refresh
                        </button>
                        <span className="text-[11px] text-white/20 tabular-nums hidden sm:block">
                            {lastRefresh.toLocaleTimeString()}
                            {live?.weekday ? ` · ${live.weekday}` : ""}
                            {live?.hour != null ? ` ${live.hour}:00` : ""}
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* ─── Alert: No data ─── */}
                {!hasData && (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] px-6 py-4 flex items-center gap-4">
                        <span className="text-xl">⏳</span>
                        <div>
                            <div className="text-sm font-medium text-amber-400">Collecting live data...</div>
                            <div className="text-xs text-white/40 mt-0.5">
                                BusIQ is connecting to NTA GTFS-RT. First snapshot appears within 30 seconds. Stats refresh every 30s.
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Hero Stats Row ─── */}
                <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard
                        icon="🚌"
                        label="Live Fleet"
                        value={hasData ? (live?.total_vehicles?.toLocaleString() ?? "—") : "—"}
                        sub={hasData ? `${live?.active_routes || 0} active routes` : "Waiting for data"}
                        color="cyan"
                    />
                    <StatCard
                        icon="✓"
                        label="On-Time"
                        value={hasData ? `${live?.on_time_pct ?? 0}%` : "—"}
                        sub={hasData ? `${live?.on_time || 0} of ${live?.total_vehicles || 0}` : undefined}
                        color={
                            !hasData ? "cyan"
                                : (live?.on_time_pct || 0) >= 80 ? "green"
                                    : (live?.on_time_pct || 0) >= 60 ? "amber"
                                        : "red"
                        }
                    />
                    <StatCard
                        icon="⏱"
                        label="Avg Delay"
                        value={hasData ? `${((live?.avg_delay_seconds || 0) / 60).toFixed(1)}m` : "—"}
                        sub={hasData ? `${live?.severe_delay || 0} severely delayed` : undefined}
                        color="amber"
                    />
                    <StatCard
                        icon="👻"
                        label="Ghost Buses"
                        value={hasData ? (live?.ghost_signal_lost ?? 0) : "—"}
                        sub={hasData ? `${live?.ghost_rate_pct || 0}% of fleet` : undefined}
                        color="red"
                    />
                    <StatCard
                        icon="⚡"
                        label="Bunching"
                        value={hasData ? (live?.bunching_pairs ?? 0) : "—"}
                        sub={hasData ? `${live?.bunching_routes || 0} routes · ${live?.bunching_severe || 0} severe` : undefined}
                        color="amber"
                    />
                    <StatCard
                        icon="💀"
                        label="Dead Routes"
                        value={hasData ? (live?.ghost_dead_routes ?? 0) : "—"}
                        sub={hasData ? "Zero live buses" : undefined}
                        color="red"
                    />
                </section>

                {/* ─── Network Health + Interventions ─── */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Health gauge */}
                    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-sm p-6 flex flex-col items-center">
                        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">
                            Network Health
                        </h2>
                        {health ? (
                            <>
                                <HealthGauge score={health.score} grade={health.grade} />
                                <div className="mt-6 w-full space-y-3">
                                    {(health.components || []).map((comp) => (
                                        <HealthBar
                                            key={comp.name}
                                            name={comp.name}
                                            score={comp.score}
                                            detail={comp.detail}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <EmptyState icon="💓" title="Calculating health..." sub="Waiting for fleet data to compute the network health score" />
                        )}
                    </div>

                    {/* Active interventions */}
                    <div className="lg:col-span-2 rounded-2xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-sm p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                                Active Interventions
                            </h2>
                            {interventions.length > 0 && (
                                <span className="text-[10px] text-cyan-400/80 bg-cyan-400/[0.08] px-2.5 py-1 rounded-lg font-medium tabular-nums">
                                    {interventions.length} active
                                </span>
                            )}
                        </div>
                        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-hide">
                            {interventions.length > 0 ? (
                                interventions.map((i) => (
                                    <InterventionRow key={i.id} int={i} />
                                ))
                            ) : (
                                <EmptyState
                                    icon="✅"
                                    title="No active interventions"
                                    sub="The Intervention Engine generates HOLD, DEPLOY, SURGE, and EXPRESS actions when issues are detected"
                                />
                            )}
                        </div>
                    </div>
                </section>

                {/* ─── Worst Routes ─── */}
                <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-sm p-6">
                    <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">
                        Worst-Performing Routes
                    </h2>
                    {(live?.top_delayed_routes?.length ?? 0) > 0 ? (
                        <div className="space-y-0.5">
                            {live!.top_delayed_routes.map((r, idx) => (
                                <DelayBar
                                    key={r.route}
                                    route={r.route}
                                    delay={r.avg_delay}
                                    vehicles={r.vehicles}
                                    maxDelay={maxDelay}
                                    rank={idx + 1}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon="📊" title="No route delay data yet" sub="Route performance data appears after the first stats collection cycle" />
                    )}
                </section>

                {/* ─── Delay Distribution ─── */}
                <section>
                    <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">
                        Delay Distribution
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            label="On Time (< 5 min)"
                            value={hasData ? (live?.on_time ?? 0) : "—"}
                            color="green"
                        />
                        <StatCard
                            label="Slight (5–10 min)"
                            value={hasData ? (live?.slight_delay ?? 0) : "—"}
                            color="cyan"
                        />
                        <StatCard
                            label="Moderate (10–15 min)"
                            value={hasData ? (live?.moderate_delay ?? 0) : "—"}
                            color="amber"
                        />
                        <StatCard
                            label="Severe (15+ min)"
                            value={hasData ? (live?.severe_delay ?? 0) : "—"}
                            color="red"
                        />
                    </div>
                </section>

                {/* ─── Killer Stat ─── */}
                {killerStat && (
                    <section className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.03] via-transparent to-purple-500/[0.03] p-10 text-center">
                        <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-4 font-medium">
                            The Killer Stat
                        </div>
                        <div className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300 mb-2 tabular-nums">
                            {killerStat.value}
                        </div>
                        <div className="text-lg md:text-xl text-white/60 font-medium mb-4">
                            {killerStat.label}
                        </div>
                        <div className="text-sm text-white/35 max-w-2xl mx-auto leading-relaxed">
                            {killerStat.detail}
                        </div>
                    </section>
                )}

                {/* ─── Footer ─── */}
                <footer className="text-center pt-8 pb-12 space-y-2">
                    <div className="text-white/15 text-xs font-medium tracking-wider">
                        BusIQ — Real-time Operations Intelligence for Dublin Bus
                    </div>
                    <div className="text-white/10 text-[11px]">
                        Data: NTA GTFS-RT (live) · {live?.total_vehicles || 0} vehicles · {live?.active_routes || 0} routes · Updated every 30s
                    </div>
                    <div className="text-white/10 text-[11px]">
                        Dublin Bus Innovation Challenge 2026
                    </div>
                </footer>
            </main>
        </div>
    );
}
