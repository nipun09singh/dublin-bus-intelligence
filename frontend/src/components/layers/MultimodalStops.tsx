"use client";

import { useEffect, useState } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type { CircleLayerSpecification, SymbolLayerSpecification } from "mapbox-gl";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * MultimodalStops — Luas, DART, and Dublin Bikes stations on the map.
 *
 * Rendered as colour-coded dots following the design doc palette:
 * - Luas: #6B2D8B (purple)
 * - DART: #0072CE (blue)
 * - Bikes: #76B82A (green)
 *
 * Only visible at zoom >= 12. Labels at zoom >= 14.
 */
export default function MultimodalStops() {
    const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(
        null
    );

    useEffect(() => {
        let cancelled = false;

        async function loadStops() {
            try {
                const resp = await fetch(
                    `${API_URL}/api/v1/journey/stops`
                );
                if (!resp.ok) return;
                const data = await resp.json();
                if (!cancelled && data.type === "FeatureCollection") {
                    setGeojson(data);
                }
            } catch {
                // Silently fail — non-critical.
            }
        }

        loadStops();
        // Refresh every 2 minutes (Dublin Bikes availability changes)
        const timer = setInterval(loadStops, 120_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    if (!geojson) return null;

    const circleStyle: CircleLayerSpecification = {
        id: "multimodal-stops",
        type: "circle",
        source: "multimodal-stops",
        minzoom: 12,
        paint: {
            "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                12, 3,
                15, 6,
            ],
            "circle-color": [
                "match",
                ["get", "mode"],
                "luas", "#6B2D8B",
                "dart", "#0072CE",
                "bike", "#76B82A",
                "#888888",
            ],
            "circle-opacity": 0.85,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#000",
            "circle-stroke-opacity": 0.6,
        },
    };

    const glowStyle: CircleLayerSpecification = {
        id: "multimodal-stops-glow",
        type: "circle",
        source: "multimodal-stops",
        minzoom: 12,
        paint: {
            "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                12, 8,
                15, 14,
            ],
            "circle-color": [
                "match",
                ["get", "mode"],
                "luas", "#6B2D8B",
                "dart", "#0072CE",
                "bike", "#76B82A",
                "#888888",
            ],
            "circle-opacity": 0.15,
            "circle-blur": 1,
        },
    };

    const labelStyle: SymbolLayerSpecification = {
        id: "multimodal-labels",
        type: "symbol",
        source: "multimodal-stops",
        minzoom: 14,
        layout: {
            "text-field": ["get", "name"],
            "text-size": 10,
            "text-offset": [0, 1.5],
            "text-anchor": "top",
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-max-width": 8,
        },
        paint: {
            "text-color": [
                "match",
                ["get", "mode"],
                "luas", "#B87FD9",
                "dart", "#60A5FA",
                "bike", "#A3E635",
                "#aaaaaa",
            ],
            "text-halo-color": "#000",
            "text-halo-width": 1,
            "text-opacity": 0.8,
        },
    };

    return (
        <Source id="multimodal-stops" type="geojson" data={geojson}>
            <Layer {...glowStyle} />
            <Layer {...circleStyle} />
            <Layer {...labelStyle} />
        </Source>
    );
}
