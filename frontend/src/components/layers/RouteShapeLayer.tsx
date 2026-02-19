"use client";

import { useEffect } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type { LinePaint } from "mapbox-gl";
import { useBusStore } from "@/lib/store";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [],
};

/**
 * RouteShapeLayer — renders Dublin Bus route arteries on the map.
 *
 * Fetches GeoJSON shapes from the backend on mount,
 * then renders them as semi-transparent teal lines.
 * Active route (from vehicle selection) glows brighter.
 */
export default function RouteShapeLayer() {
    const routeShapes = useBusStore((s) => s.routeShapes);
    const shapesLoaded = useBusStore((s) => s.shapesLoaded);
    const setRouteShapes = useBusStore((s) => s.setRouteShapes);
    const activeRouteId = useBusStore((s) => s.activeRouteId);

    // Fetch shapes on mount
    useEffect(() => {
        if (shapesLoaded) return;

        const fetchShapes = async () => {
            try {
                const resp = await fetch(`${API_URL}/routes/shapes`);
                if (!resp.ok) return;
                const geojson = await resp.json();
                setRouteShapes(geojson);
            } catch (err) {
                console.error("[BusIQ] Failed to fetch route shapes:", err);
            }
        };

        fetchShapes();
    }, [shapesLoaded, setRouteShapes]);

    const data = routeShapes || EMPTY_GEOJSON;

    // Base route lines — subtle teal arteries
    const routeLinePaint: LinePaint = {
        "line-color": [
            "case",
            ["==", ["get", "route_id"], activeRouteId || ""],
            "rgba(0, 168, 181, 0.6)",  // Active route: brighter
            "rgba(0, 168, 181, 0.12)",  // Default: very subtle
        ],
        "line-width": [
            "case",
            ["==", ["get", "route_id"], activeRouteId || ""],
            3.5,  // Active route: thicker
            1.2,  // Default: thin arteries
        ],
        "line-opacity": 1,
    };

    // Glow layer for active route
    const routeGlowPaint: LinePaint = {
        "line-color": "rgba(0, 168, 181, 0.2)",
        "line-width": 10,
        "line-blur": 6,
        "line-opacity": [
            "case",
            ["==", ["get", "route_id"], activeRouteId || ""],
            1,
            0,
        ],
    };

    return (
        <Source id="route-shapes" type="geojson" data={data}>
            {/* Glow underneath (only visible for active route) */}
            <Layer
                id="route-glow"
                type="line"
                paint={routeGlowPaint}
                layout={{ "line-cap": "round", "line-join": "round" }}
                beforeId="vehicle-glow"
            />
            {/* Base route lines */}
            <Layer
                id="route-lines"
                type="line"
                paint={routeLinePaint}
                layout={{ "line-cap": "round", "line-join": "round" }}
                beforeId="vehicle-glow"
            />
        </Source>
    );
}
