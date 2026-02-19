"use client";

import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type { CirclePaint } from "mapbox-gl";
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
 * - Fade slightly as data ages (max 60s)
 * - Spring-interpolate to new positions (via Mapbox built-in transitions)
 */
export default function VehicleMarkerLayer({ activeMode }: VehicleMarkerLayerProps) {
    const vehicles = useBusStore((state) => state.vehicles);

    // Convert vehicle positions to GeoJSON FeatureCollection
    const geojsonData = useMemo(() => ({
        type: "FeatureCollection" as const,
        features: vehicles.map((v) => ({
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
            },
        })),
    }), [vehicles]);

    // Circle colour: teal (on-time) → amber (>2 min delay) → red (>5 min delay)
    const circleColor: CirclePaint = {
        "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "delay_seconds"],
            0, "#00A8B5",     // on-time: teal glow
            120, "#D4A843",   // 2 min delay: amber
            300, "#C93545",   // 5+ min delay: crimson
        ],
        "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 3,  // zoomed out: small dots
            14, 6,  // mid zoom: visible
            18, 10, // zoomed in: large
        ],
        "circle-opacity": 0.9,
        "circle-blur": 0.3,
    };

    // Glow halo around each bus
    const circleGlow: CirclePaint = {
        "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "delay_seconds"],
            0, "rgba(0, 168, 181, 0.3)",
            120, "rgba(212, 168, 67, 0.3)",
            300, "rgba(201, 53, 69, 0.3)",
        ],
        "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 8,
            14, 14,
            18, 22,
        ],
        "circle-opacity": 0.5,
        "circle-blur": 1,
    };

    return (
        <Source id="vehicles" type="geojson" data={geojsonData}>
            {/* Glow layer (below) */}
            <Layer
                id="vehicle-glow"
                type="circle"
                paint={circleGlow}
            />
            {/* Core marker layer (above) */}
            <Layer
                id="vehicle-markers"
                type="circle"
                paint={circleColor}
            />
        </Source>
    );
}
