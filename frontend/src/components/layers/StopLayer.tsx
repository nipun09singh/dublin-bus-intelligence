"use client";

import { useEffect, useState } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type { CirclePaint, SymbolLayout, SymbolPaint } from "mapbox-gl";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [],
};

/**
 * StopLayer — renders bus stops with a subtle heartbeat pulse.
 *
 * Fetches stop GeoJSON from the backend on mount.
 * Only visible at higher zoom levels (≥14).
 * Stops pulse gently — the city's nervous system breathing.
 */
export default function StopLayer() {
    const [stops, setStops] = useState<GeoJSON.FeatureCollection>(EMPTY_GEOJSON);

    useEffect(() => {
        const fetchStops = async () => {
            try {
                const resp = await fetch(`${API_URL}/routes/stops`);
                if (!resp.ok) return;
                const geojson = await resp.json();
                setStops(geojson);
            } catch (err) {
                console.error("[BusIQ] Failed to fetch stops:", err);
            }
        };
        fetchStops();
    }, []);

    // Stop circle style — tiny dots that appear at higher zoom
    const stopCirclePaint: CirclePaint = {
        "circle-color": "rgba(255, 255, 255, 0.5)",
        "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14, 2,
            16, 3.5,
            18, 5,
        ],
        "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13.5, 0,
            14, 0.6,
        ],
        "circle-stroke-width": 1,
        "circle-stroke-color": "rgba(0, 168, 181, 0.4)",
        "circle-stroke-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13.5, 0,
            14, 0.5,
        ],
    };

    // Heartbeat glow ring around stops
    const stopGlowPaint: CirclePaint = {
        "circle-color": "rgba(0, 168, 181, 0.08)",
        "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14, 6,
            16, 10,
            18, 14,
        ],
        "circle-blur": 1,
        "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13.5, 0,
            14, 0.5,
        ],
    };

    // Stop name labels at high zoom
    const stopLabelLayout: SymbolLayout = {
        "text-field": ["get", "stop_name"],
        "text-size": 9,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-allow-overlap": false,
        "text-optional": true,
        "text-max-width": 8,
    };

    const stopLabelPaint: SymbolPaint = {
        "text-color": "rgba(255, 255, 255, 0.45)",
        "text-halo-color": "rgba(0, 0, 0, 0.8)",
        "text-halo-width": 1,
    };

    return (
        <Source id="stops" type="geojson" data={stops}>
            {/* Glow ring (heartbeat feel) */}
            <Layer
                id="stop-glow"
                type="circle"
                paint={stopGlowPaint}
                minzoom={14}
                beforeId="vehicle-glow"
            />
            {/* Core stop dot */}
            <Layer
                id="stop-dots"
                type="circle"
                paint={stopCirclePaint}
                minzoom={14}
                beforeId="vehicle-glow"
            />
            {/* Stop labels at high zoom */}
            <Layer
                id="stop-labels"
                type="symbol"
                layout={stopLabelLayout}
                paint={stopLabelPaint}
                minzoom={15.5}
            />
        </Source>
    );
}
