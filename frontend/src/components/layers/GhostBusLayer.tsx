"use client";

import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type { CirclePaint, SymbolLayout, SymbolPaint } from "mapbox-gl";
import { useBusStore } from "@/lib/store";

/**
 * GhostBusLayer — renders "ghost" buses that are scheduled but not reporting.
 *
 * In Optimisation mode, compares scheduled service against live vehicle feed
 * to detect missing/phantom buses. These appear as translucent, dashed-outline
 * markers on the map — haunting visual of service gaps.
 *
 * For the demo, we detect buses whose data is stale (>90s since last update)
 * as a proxy for ghost buses.
 */
export default function GhostBusLayer() {
    const vehicles = useBusStore((state) => state.vehicles);

    // Ghost buses: vehicles with stale data (>90s old)
    const ghostData = useMemo(() => {
        const now = Date.now();
        const ghosts = vehicles.filter((v) => {
            const age = now - new Date(v.timestamp).getTime();
            return age > 90000; // 90+ seconds stale
        });

        return {
            type: "FeatureCollection" as const,
            features: ghosts.map((v) => ({
                type: "Feature" as const,
                geometry: {
                    type: "Point" as const,
                    coordinates: [v.longitude, v.latitude],
                },
                properties: {
                    vehicle_id: v.vehicle_id,
                    route_short_name: v.route_short_name || v.route_id,
                    age_seconds: Math.round(
                        (now - new Date(v.timestamp).getTime()) / 1000
                    ),
                },
            })),
        };
    }, [vehicles]);

    // Ghost marker: translucent with dashed stroke
    const ghostPaint: CirclePaint = {
        "circle-color": "rgba(255, 255, 255, 0.05)",
        "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 4,
            14, 7,
            18, 12,
        ],
        "circle-opacity": 0.4,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "rgba(255, 255, 255, 0.25)",
        "circle-blur": 0.5,
    };

    // Ghost labels
    const ghostLabelLayout: SymbolLayout = {
        "text-field": "👻",
        "text-size": 12,
        "text-offset": [0, -1.8],
        "text-anchor": "bottom",
        "text-allow-overlap": true,
    };

    if (ghostData.features.length === 0) return null;

    return (
        <Source id="ghost-buses" type="geojson" data={ghostData}>
            <Layer
                id="ghost-markers"
                type="circle"
                paint={ghostPaint}
            />
            <Layer
                id="ghost-labels"
                type="symbol"
                layout={ghostLabelLayout}
                minzoom={13}
            />
        </Source>
    );
}
