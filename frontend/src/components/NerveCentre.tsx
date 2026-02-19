"use client";

import { useRef, useCallback, useState } from "react";
import Map, { MapRef, NavigationControl } from "react-map-gl/mapbox";
import type { MapLayerMouseEvent } from "react-map-gl/mapbox";
import { PillarMode } from "@/lib/types";
import { useBusStore } from "@/lib/store";
import { useWebSocket } from "@/hooks/useWebSocket";
import PulseRing from "@/components/overlays/PulseRing";
import PillarRail from "@/components/overlays/PillarRail";
import VehicleInfoCard from "@/components/overlays/VehicleInfoCard";
import VehicleMarkerLayer from "@/components/layers/VehicleMarkerLayer";
import RouteShapeLayer from "@/components/layers/RouteShapeLayer";
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
        (e: MapLayerMouseEvent) => {
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
    const handleMouseLeave = useCallback(() => setCursor("grab"), []);

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
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                cursor={cursor}
                interactiveLayerIds={["vehicle-markers"]}
                attributionControl={false}
                maxZoom={18}
                minZoom={10}
            >
                <NavigationControl position="top-right" showCompass={false} />

                {/* ─── Map Layers (z-order matters) ─── */}
                {mapLoaded && (
                    <>
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

            {/* Connection status indicator */}
            <div className="absolute top-6 right-6 z-30 flex items-center gap-2">
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
