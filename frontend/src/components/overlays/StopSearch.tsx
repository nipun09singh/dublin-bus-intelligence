"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBusStore } from "@/lib/store";
import type { StopInfo } from "@/lib/types";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * StopSearch — "Find my stop" search overlay.
 *
 * Type a stop name → see matching stops → tap one to see live ETAs.
 * This is what a Dubliner at a bus stop actually wants.
 */
export default function StopSearch({
    onClose,
    onFlyTo,
}: {
    onClose: () => void;
    onFlyTo?: (lat: number, lon: number) => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<StopInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const selectStop = useBusStore((s) => s.selectStop);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-focus the input
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const doSearch = useCallback(async (q: string) => {
        if (q.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/routes/stops/search?q=${encodeURIComponent(q)}&limit=12`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            setResults(json.data || []);
        } catch (err) {
            console.error("[BusIQ] Stop search failed:", err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value;
            setQuery(val);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => doSearch(val), 250);
        },
        [doSearch]
    );

    const handleSelect = useCallback(
        (stop: StopInfo) => {
            selectStop(stop);
            onFlyTo?.(stop.latitude, stop.longitude);
            onClose();
        },
        [selectStop, onFlyTo, onClose]
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="glass p-4"
            style={{ width: "clamp(280px, 30vw, 380px)" }}
        >
            {/* Search header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleInput}
                        placeholder="Search stops... e.g. O'Connell, Phibsborough"
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 focus:outline-none focus:border-[#00A8B5]/50 transition-colors"
                    />
                    {loading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-white/20 border-t-[#00A8B5] rounded-full animate-spin" />
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
                >
                    ✕
                </button>
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto scrollbar-hide space-y-1">
                {results.length === 0 && query.length >= 2 && !loading && (
                    <div className="text-center py-4">
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            No stops found for &ldquo;{query}&rdquo;
                        </span>
                    </div>
                )}
                {results.length === 0 && query.length < 2 && (
                    <div className="text-center py-4">
                        <div className="text-2xl mb-2">🚏</div>
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            Type a stop name to find live bus arrivals
                        </span>
                    </div>
                )}
                <AnimatePresence mode="popLayout">
                    {results.map((stop) => (
                        <motion.button
                            key={stop.stop_id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            onClick={() => handleSelect(stop)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/[0.06]"
                            style={{ border: "1px solid transparent" }}
                        >
                            <div
                                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs"
                                style={{ background: "rgba(0, 168, 181, 0.1)", color: "#00A8B5" }}
                            >
                                🚏
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                    {stop.stop_name}
                                </div>
                                <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                                    Stop {stop.stop_id.replace(/^8220DB/, "")}
                                </div>
                            </div>
                            <div className="flex-shrink-0 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                                →
                            </div>
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
