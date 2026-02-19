"use client";

import { useEffect, useRef, useCallback } from "react";
import { Source, Layer, useMap } from "react-map-gl/mapbox";
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
    const { current: mapInstance } = useMap();
    const animFrameRef = useRef<number>(0);
    const dashOffsetRef = useRef(0);

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

    // Animate flow particles on active route via line-dasharray manipulation
    const animateFlow = useCallback(() => {
        if (!mapInstance) return;
        const map = mapInstance.getMap();
        if (!map || !map.getLayer("route-flow-particles")) return;

        dashOffsetRef.current = (dashOffsetRef.current + 0.4) % 20;
        // Shift dash pattern to simulate flowing particles
        const phase = dashOffsetRef.current;
        const dashLen = 2 + Math.sin(phase * 0.3) * 0.5;
        const gapLen = 18 - dashLen;
        map.setPaintProperty("route-flow-particles", "line-dasharray", [
            dashLen,
            gapLen,
        ]);

        animFrameRef.current = requestAnimationFrame(animateFlow);
    }, [mapInstance]);

    useEffect(() => {
        if (activeRouteId && mapInstance) {
            animFrameRef.current = requestAnimationFrame(animateFlow);
        }
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [activeRouteId, mapInstance, animateFlow]);

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

    // Flow particle paint — animated dashes on active route
    const flowParticlePaint: LinePaint = {
        "line-color": "rgba(0, 220, 235, 0.7)",
        "line-width": 2,
        "line-dasharray": [2, 18],
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
            />
            {/* Base route lines */}
            <Layer
                id="route-lines"
                type="line"
                paint={routeLinePaint}
                layout={{ "line-cap": "round", "line-join": "round" }}
            />
            {/* Flow particles — animated dashes showing direction on active route */}
            <Layer
                id="route-flow-particles"
                type="line"
                paint={flowParticlePaint}
                layout={{ "line-cap": "round", "line-join": "round" }}
            />
        </Source>
    );
}
