"use client";

import { useRef, useCallback, useState } from "react";
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
import VehicleMarkerLayer from "@/components/layers/VehicleMarkerLayer";
import RouteShapeLayer from "@/components/layers/RouteShapeLayer";
import StopLayer from "@/components/layers/StopLayer";
import GhostBusLayer from "@/components/layers/GhostBusLayer";
import BunchingLayer from "@/components/layers/BunchingLayer";

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
                    </>
                )}
            </Map>

            {/* ─── Glass Overlays (HTML over map) ─── */}

            {/* Top-left: Pulse Ring — live fleet counter */}
            <PulseRing busCount={busCount} />

            {/* Top-right: Vehicle info card (when selected) */}
            <VehicleInfoCard />

            {/* Route hover card (follows cursor on route lines) */}
            <RouteHoverCard
                routeId={hoveredRoute?.routeId ?? null}
                routeName={hoveredRoute?.routeName ?? null}
                x={hoveredRoute?.x ?? 0}
                y={hoveredRoute?.y ?? 0}
            />

            {/* Collaboration: Crowd report panel (collab mode + selected bus) */}
            {activeMode === "collab" && <CrowdReportPanel />}

            {/* Collaboration: Community pulse feed (collab mode) */}
            {activeMode === "collab" && <CommunityPulse />}

            {/* Optimise: Ghost bus panel */}
            {activeMode === "optimise" && <GhostBusPanel />}

            {/* Optimise: Bunching alert panel */}
            {activeMode === "optimise" && <BunchingAlertPanel />}

            {/* Connection status indicator */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-2">
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
