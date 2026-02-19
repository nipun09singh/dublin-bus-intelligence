"use client";

import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type { CirclePaint, SymbolLayout, SymbolPaint } from "mapbox-gl";
import { PillarMode } from "@/lib/types";
import { useBusStore } from "@/lib/store";

interface VehicleMarkerLayerProps {
    activeMode: PillarMode;
}

/**
 * VehicleMarkerLayer — renders all live bus positions on the map.
 *
 * Buses are rendered as glowing circles that:
 * - Shift colour based on delay (teal → amber → red)
 * - Fade as data ages (max 120s → 50% opacity)
 * - Show route labels at higher zoom levels
 * - Respond to click events → select vehicle in store
 */
export default function VehicleMarkerLayer({
    activeMode,
}: VehicleMarkerLayerProps) {
    const vehicles = useBusStore((state) => state.vehicles);
    const selectedVehicle = useBusStore((state) => state.selectedVehicle);
    const activeRouteId = useBusStore((state) => state.activeRouteId);

    // Convert vehicle positions to GeoJSON FeatureCollection
    const geojsonData = useMemo(() => {
        const now = Date.now();
        return {
            type: "FeatureCollection" as const,
            features: vehicles.map((v) => {
                const ageMs = now - new Date(v.timestamp).getTime();
                const ageSeconds = Math.max(0, Math.min(120, ageMs / 1000));
                // Opacity: full at 0s, fades to 0.5 at 120s
                const ageOpacity = Math.max(0.5, 1 - ageSeconds / 240);
                // Is this vehicle's route the active one?
                const isActiveRoute = activeRouteId
                    ? v.route_id === activeRouteId
                    : false;
                const isSelected = selectedVehicle?.vehicle_id === v.vehicle_id;

                return {
                    type: "Feature" as const,
                    geometry: {
                        type: "Point" as const,
                        coordinates: [v.longitude, v.latitude],
                    },
                    properties: {
                        vehicle_id: v.vehicle_id,
                        route_id: v.route_id,
                        route_short_name: v.route_short_name || v.route_id,
                        delay_seconds: v.delay_seconds,
                        speed_kmh: v.speed_kmh ?? 0,
                        bearing: v.bearing ?? 0,
                        occupancy_status: v.occupancy_status,
                        age_opacity: ageOpacity,
                        is_active_route: isActiveRoute ? 1 : 0,
                        is_selected: isSelected ? 1 : 0,
                    },
                };
            }),
        };
    }, [vehicles, activeRouteId, selectedVehicle]);

    // Circle colour: teal (on-time) → amber (>2 min delay) → red (>5 min delay)
    const circleColor: CirclePaint = {
        "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "delay_seconds"],
            0,
            "#00A8B5", // on-time: teal glow
            120,
            "#D4A843", // 2 min delay: amber
            300,
            "#C93545", // 5+ min delay: crimson
        ],
        "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            3, // zoomed out: small dots
            14,
            6, // mid zoom: visible
            18,
            10, // zoomed in: large
        ],
        "circle-opacity": [
            "case",
            ["==", ["get", "is_selected"], 1],
            1, // Selected: full opacity
            ["==", ["get", "is_active_route"], 1],
            0.95, // Active route: nearly full
            ["get", "age_opacity"], // Others: fade with data age
        ],
        "circle-blur": 0.3,
        "circle-stroke-width": [
            "case",
            ["==", ["get", "is_selected"], 1],
            2.5,
            0,
        ],
        "circle-stroke-color": "#FFFFFF",
    };

    // Glow halo around each bus
    const circleGlow: CirclePaint = {
        "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "delay_seconds"],
            0,
            "rgba(0, 168, 181, 0.3)",
            120,
            "rgba(212, 168, 67, 0.3)",
            300,
            "rgba(201, 53, 69, 0.3)",
        ],
        "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            8,
            14,
            14,
            18,
            22,
        ],
        "circle-opacity": [
            "case",
            ["==", ["get", "is_selected"], 1],
            0.8,
            ["==", ["get", "is_active_route"], 1],
            0.6,
            ["*", 0.4, ["get", "age_opacity"]],
        ],
        "circle-blur": 1,
    };

    // Route label paint — visible at zoom ≥ 13
    const labelLayout: SymbolLayout = {
        "text-field": ["get", "route_short_name"],
        "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            8,
            16,
            11,
        ],
        "text-offset": [0, -1.5],
        "text-anchor": "bottom",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-optional": true,
    };

    const labelPaint: SymbolPaint = {
        "text-color": [
            "case",
            ["==", ["get", "is_selected"], 1],
            "#FFFFFF",
            ["==", ["get", "is_active_route"], 1],
            "rgba(255,255,255,0.9)",
            "rgba(255,255,255,0.6)",
        ],
        "text-halo-color": "rgba(0,0,0,0.8)",
        "text-halo-width": 1.5,
    };

    return (
        <Source id="vehicles" type="geojson" data={geojsonData}>
            {/* Glow layer (below) */}
            <Layer id="vehicle-glow" type="circle" paint={circleGlow} />
            {/* Core marker layer (above) — interactive via Map onClick */}
            <Layer
                id="vehicle-markers"
                type="circle"
                paint={circleColor}
            />
            {/* Route labels (highest zoom) */}
            <Layer
                id="vehicle-labels"
                type="symbol"
                layout={labelLayout}
                paint={labelPaint}
                minzoom={13}
            />
        </Source>
    );
}
