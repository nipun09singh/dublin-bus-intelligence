"use client";

import { useRef, useCallback, useState } from "react";
import Link from "next/link";
import Map, { MapRef, NavigationControl } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "react-map-gl/mapbox";
import { PillarMode } from "@/lib/types";
import { useBusStore } from "@/lib/store";
import { useWebSocket } from "@/hooks/useWebSocket";
import PulseRing from "@/components/overlays/PulseRing";
import PillarRail from "@/components/overlays/PillarRail";
import VehicleInfoCard from "@/components/overlays/VehicleInfoCard";
import RouteHoverCard from "@/components/overlays/RouteHoverCard";
import CrowdReportPanel from "@/components/overlays/CrowdReportPanel";
import GhostBusPanel from "@/components/overlays/GhostBusPanel";
import BunchingAlertPanel from "@/components/overlays/BunchingAlertPanel";
import CommunityPulse from "@/components/overlays/CommunityPulse";
import JourneyPlanner from "@/components/overlays/JourneyPlanner";
import CarbonBadge from "@/components/overlays/CarbonBadge";
import VehicleMarkerLayer from "@/components/layers/VehicleMarkerLayer";
import RouteShapeLayer from "@/components/layers/RouteShapeLayer";
import StopLayer from "@/components/layers/StopLayer";
import GhostBusLayer from "@/components/layers/GhostBusLayer";
import BunchingLayer from "@/components/layers/BunchingLayer";
import JourneyRibbon from "@/components/layers/JourneyRibbon";
import MultimodalStops from "@/components/layers/MultimodalStops";
import SentimentAurora from "@/components/overlays/SentimentAurora";
import DemoAutoPilot from "@/components/overlays/DemoAutoPilot";
import CommandConsole from "@/components/overlays/CommandConsole";

const DUBLIN_CENTER = { latitude: 53.3498, longitude: -6.2603 };
const INITIAL_ZOOM = 12;

/**
 * NerveCentre — the single-canvas interface.
 *
 * The map IS the app. Everything floats over it.
 * Pillar modes transform layers, not routes.
 */
export default function NerveCentre() {
    const mapRef = useRef<MapRef>(null);
    const [activeMode, setActiveMode] = useState<PillarMode>("data-viz");
    const [mapLoaded, setMapLoaded] = useState(false);

    // Journey planner state (Smart Cities mode)
    const [journeyOptions, setJourneyOptions] = useState<any[]>([]);
    const [selectedJourney, setSelectedJourney] = useState(0);
    const [carbonSavings, setCarbonSavings] = useState<{
        kg: number;
        percent: number;
    } | null>(null);

    // Demo auto-pilot state
    const [demoActive, setDemoActive] = useState(false);

    // Connect to live WebSocket feed
    useWebSocket();
    const busCount = useBusStore((s) => s.vehicles.length);
    const connected = useBusStore((s) => s.connected);
    const lastUpdate = useBusStore((s) => s.lastUpdate);
    const selectVehicle = useBusStore((s) => s.selectVehicle);

    const handleMapLoad = useCallback(() => {
        setMapLoaded(true);
    }, []);

    // Click handler: select vehicle or deselect
    const handleMapClick = useCallback(
        (e: MapMouseEvent) => {
            // Check if we clicked on a vehicle marker
            if (e.features && e.features.length > 0) {
                const vehicleId = e.features[0].properties?.vehicle_id;
                if (vehicleId) {
                    const vehicles = useBusStore.getState().vehicles;
                    const vehicle = vehicles.find(
                        (v) => v.vehicle_id === vehicleId
                    );
                    if (vehicle) {
                        selectVehicle(vehicle);
                        return;
                    }
                }
            }
            // Clicked on empty space → deselect
            selectVehicle(null);
        },
        [selectVehicle]
    );

    // Cursor changes to pointer over interactive layers
    const [cursor, setCursor] = useState("grab");
    const handleMouseEnter = useCallback(() => setCursor("pointer"), []);
    const handleMouseLeave = useCallback(() => {
        setCursor("grab");
        setHoveredRoute(null);
    }, []);

    // Route hover state
    const [hoveredRoute, setHoveredRoute] = useState<{
        routeId: string;
        routeName: string;
        x: number;
        y: number;
    } | null>(null);

    // Journey planner callbacks
    const handleJourneyPlanned = useCallback(
        (options: any[], selectedIdx: number) => {
            setJourneyOptions(options);
            setSelectedJourney(selectedIdx);
            const opt = options[selectedIdx];
            if (opt?.carbon) {
                setCarbonSavings({
                    kg: opt.carbon.savings_kg,
                    percent: opt.carbon.savings_percent,
                });
            }
        },
        []
    );
    const handleJourneyClear = useCallback(() => {
        setJourneyOptions([]);
        setSelectedJourney(0);
        setCarbonSavings(null);
    }, []);

    // Demo auto-pilot: fly to location
    const handleDemoFlyTo = useCallback(
        (opts: { lat: number; lon: number; zoom: number; pitch?: number; bearing?: number }) => {
            mapRef.current?.flyTo({
                center: [opts.lon, opts.lat],
                zoom: opts.zoom,
                pitch: opts.pitch ?? 0,
                bearing: opts.bearing ?? 0,
                duration: 2000,
            });
        },
        []
    );
    const handleDemoEnd = useCallback(() => setDemoActive(false), []);

    // Intervention fly-to handler (Command Console)
    const handleInterventionFlyTo = useCallback(
        (lat: number, lon: number) => {
            mapRef.current?.flyTo({
                center: [lon, lat],
                zoom: 15,
                duration: 1500,
            });
        },
        []
    );

    // Handle mouse move for route hover cards
    const handleMouseMove = useCallback((e: MapMouseEvent) => {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            // Check if it's a route line (not a vehicle marker)
            if (feature.layer?.id === "route-lines") {
                const routeId = feature.properties?.route_id;
                const routeName = feature.properties?.route_short_name;
                if (routeId) {
                    setHoveredRoute({
                        routeId,
                        routeName: routeName || routeId,
                        x: e.point.x,
                        y: e.point.y,
                    });
                    setCursor("pointer");
                    return;
                }
            }
        }
        setHoveredRoute(null);
    }, []);

    // Format last update time
    const updateAge = lastUpdate
        ? `${Math.round((Date.now() - new Date(lastUpdate).getTime()) / 1000)}s`
        : "—";

    return (
        <div className="relative h-screen w-screen overflow-hidden">
            {/* ─── The Map Canvas ─── */}
            <Map
                ref={mapRef}
                initialViewState={{
                    ...DUBLIN_CENTER,
                    zoom: INITIAL_ZOOM,
                    pitch: 0,
                    bearing: 0,
                }}
                style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                onLoad={handleMapLoad}
                onClick={handleMapClick}
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                cursor={cursor}
                interactiveLayerIds={["vehicle-markers", "route-lines"]}
                attributionControl={false}
                maxZoom={18}
                minZoom={10}
            >
                <NavigationControl position="top-right" showCompass={false} />

                {/* ─── Map Layers (z-order matters) ─── */}
                {mapLoaded && (
                    <>
                        {/* Layer 1: Stop heartbeat dots (high zoom only) */}
                        <StopLayer />

                        {/* Layer 2: Route shape arteries (always shown) */}
                        <RouteShapeLayer />

                        {/* Layer 3: Bunching arcs (optimise mode) */}
                        {activeMode === "optimise" && <BunchingLayer />}

                        {/* Layer 4: Ghost bus markers (optimise mode) */}
                        {activeMode === "optimise" && <GhostBusLayer />}

                        {/* Layer 5: Vehicle markers (always shown) */}
                        <VehicleMarkerLayer activeMode={activeMode} />

                        {/* Layer 6: Multimodal stops (smart-cities mode) */}
                        {activeMode === "smart-cities" && <MultimodalStops />}

                        {/* Layer 7: Journey ribbons (smart-cities mode, when planned) */}
                        {activeMode === "smart-cities" &&
                            journeyOptions.length > 0 && (
                                <JourneyRibbon
                                    options={journeyOptions}
                                    selectedIdx={selectedJourney}
                                />
                            )}
                    </>
                )}
            </Map>

            {/* ─── Glass Overlays (HTML over map) ─── */}

            {/* Sentiment Aurora — mood ring gradient (collab mode) */}
            {activeMode === "collab" && <SentimentAurora />}

            {/* Demo Auto-Pilot teleprompter */}
            <DemoAutoPilot
                active={demoActive}
                onModeChange={setActiveMode}
                onFlyTo={handleDemoFlyTo}
                onEnd={handleDemoEnd}
            />

            {/* ─── LEFT COLUMN: Health + Mode Panel (stacked, scrollable) ─── */}
            <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-40 flex flex-col gap-3 max-h-[calc(100vh-6rem)] pointer-events-none" style={{ width: 'clamp(240px, 22vw, 320px)' }}>
                <div className="pointer-events-auto">
                    <PulseRing busCount={busCount} />
                </div>
                {activeMode === "optimise" && (
                    <div className="pointer-events-auto overflow-y-auto flex-1 min-h-0 scrollbar-hide">
                        <CommandConsole onFlyTo={handleInterventionFlyTo} />
                    </div>
                )}
                {activeMode === "smart-cities" && (
                    <div className="pointer-events-auto">
                        <JourneyPlanner
                            onJourneyPlanned={handleJourneyPlanned}
                            onClear={handleJourneyClear}
                        />
                    </div>
                )}
            </div>

            {/* ─── RIGHT COLUMN: Info + Alerts (stacked) ─── */}
            <div className="absolute top-14 right-4 sm:top-16 sm:right-5 z-40 flex flex-col gap-3 max-h-[calc(100vh-7rem)] pointer-events-none" style={{ width: 'clamp(220px, 18vw, 280px)' }}>
                <div className="pointer-events-auto">
                    <VehicleInfoCard />
                </div>
                {activeMode === "optimise" && (
                    <>
                        <div className="pointer-events-auto">
                            <GhostBusPanel />
                        </div>
                        <div className="pointer-events-auto">
                            <BunchingAlertPanel />
                        </div>
                    </>
                )}
                {activeMode === "collab" && (
                    <div className="pointer-events-auto">
                        <CommunityPulse />
                    </div>
                )}
            </div>

            {/* Route hover card (follows cursor on route lines) */}
            <RouteHoverCard
                routeId={hoveredRoute?.routeId ?? null}
                routeName={hoveredRoute?.routeName ?? null}
                x={hoveredRoute?.x ?? 0}
                y={hoveredRoute?.y ?? 0}
            />

            {/* Collaboration: Crowd report panel (collab mode + selected bus) */}
            {activeMode === "collab" && <CrowdReportPanel />}

            {/* Smart Cities: Carbon savings badge */}
            {activeMode === "smart-cities" && carbonSavings && (
                <CarbonBadge
                    savingsKg={carbonSavings.kg}
                    savingsPercent={carbonSavings.percent}
                />
            )}

            {/* ─── TOP CENTER: Brand + Status Bar ─── */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
                {/* BusIQ Brand Mark */}
                <div className="glass px-3 py-2 flex items-center gap-2">
                    <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00808b, #00a8b5)" }}>
                        <span className="text-[9px] font-black text-white">IQ</span>
                    </div>
                    <span className="text-[11px] font-bold tracking-tight text-white/90">BusIQ</span>
                </div>

                <Link
                    href="/insights"
                    className="glass px-3 py-2 flex items-center gap-2 hover:border-cyan-400/40 transition-colors"
                    title="Open BusIQ Insights dashboard"
                >
                    <span className="text-xs">📊</span>
                    <span className="text-[10px] font-semibold tracking-wider" style={{ color: "var(--text-secondary)" }}>INSIGHTS</span>
                </Link>
                {!demoActive && (
                    <button
                        onClick={() => setDemoActive(true)}
                        className="glass px-3 py-2 flex items-center gap-2 hover:border-[#00A8B5]/40 transition-colors cursor-pointer"
                        title="Start 3-minute judge demo"
                    >
                        <span className="text-xs">▶</span>
                        <span className="text-[10px] font-semibold tracking-wider" style={{ color: "var(--text-secondary)" }}>DEMO</span>
                    </button>
                )}
                {demoActive && (
                    <button
                        onClick={() => setDemoActive(false)}
                        className="glass px-3 py-2 flex items-center gap-2 hover:border-red-400/40 transition-colors cursor-pointer"
                    >
                        <span className="text-xs">■</span>
                        <span className="text-[10px] font-semibold tracking-wider" style={{ color: "#e74c3c" }}>STOP</span>
                    </button>
                )}
                <div className="glass px-3 py-2 flex items-center gap-2">
                    <div
                        className={`h-2 w-2 rounded-full ${connected
                            ? "bg-emerald-400 animate-pulse"
                            : "bg-red-400"
                            }`}
                    />
                    <span
                        className="text-xs font-mono"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {connected ? "LIVE" : "CONNECTING"}
                    </span>
                    {connected && (
                        <span
                            className="text-xs tabular-nums"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            · {updateAge}
                        </span>
                    )}
                </div>
            </div>

            {/* Bottom: Pillar Rail — mode switcher */}
            <PillarRail activeMode={activeMode} onModeChange={setActiveMode} />
        </div>
    );
}
