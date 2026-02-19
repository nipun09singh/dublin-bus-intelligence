"use client";

import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type { LinePaint, CirclePaint } from "mapbox-gl";
import { useBusStore } from "@/lib/store";

/**
 * BunchingLayer — detects and visualises bus bunching.
 *
 * When two buses on the same route are within ~300m of each other,
 * draws a red arc between them — visual alarm for service quality.
 * Each bunching pair also gets a pulsing warning dot at midpoint.
 */
export default function BunchingLayer() {
    const vehicles = useBusStore((state) => state.vehicles);

    const bunchingData = useMemo(() => {
        // Group vehicles by route
        const byRoute: Record<string, typeof vehicles> = {};
        for (const v of vehicles) {
            const key = v.route_short_name || v.route_id;
            if (!byRoute[key]) byRoute[key] = [];
            byRoute[key].push(v);
        }

        const lines: GeoJSON.Feature[] = [];
        const midpoints: GeoJSON.Feature[] = [];

        // For each route, find pairs within ~300m
        for (const [route, buses] of Object.entries(byRoute)) {
            if (buses.length < 2) continue;

            for (let i = 0; i < buses.length; i++) {
                for (let j = i + 1; j < buses.length; j++) {
                    const a = buses[i];
                    const b = buses[j];
                    const dist = haversineMeters(
                        a.latitude,
                        a.longitude,
                        b.latitude,
                        b.longitude
                    );

                    if (dist < 300) {
                        // Bunching detected!
                        lines.push({
                            type: "Feature",
                            geometry: {
                                type: "LineString",
                                coordinates: [
                                    [a.longitude, a.latitude],
                                    [b.longitude, b.latitude],
                                ],
                            },
                            properties: {
                                route,
                                distance: Math.round(dist),
                            },
                        });
                        midpoints.push({
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: [
                                    (a.longitude + b.longitude) / 2,
                                    (a.latitude + b.latitude) / 2,
                                ],
                            },
                            properties: {
                                route,
                                distance: Math.round(dist),
                            },
                        });
                    }
                }
            }
        }

        return {
            lines: { type: "FeatureCollection" as const, features: lines },
            midpoints: {
                type: "FeatureCollection" as const,
                features: midpoints,
            },
        };
    }, [vehicles]);

    const linePaint: LinePaint = {
        "line-color": "rgba(201, 53, 69, 0.6)",
        "line-width": 2,
        "line-dasharray": [2, 2],
    };

    const midpointPaint: CirclePaint = {
        "circle-color": "#C93545",
        "circle-radius": 5,
        "circle-opacity": 0.8,
        "circle-blur": 0.3,
        "circle-stroke-width": 1,
        "circle-stroke-color": "rgba(255, 255, 255, 0.3)",
    };

    if (
        bunchingData.lines.features.length === 0 &&
        bunchingData.midpoints.features.length === 0
    )
        return null;

    return (
        <>
            <Source
                id="bunching-lines"
                type="geojson"
                data={bunchingData.lines}
            >
                <Layer id="bunching-arcs" type="line" paint={linePaint} />
            </Source>
            <Source
                id="bunching-midpoints"
                type="geojson"
                data={bunchingData.midpoints}
            >
                <Layer
                    id="bunching-dots"
                    type="circle"
                    paint={midpointPaint}
                />
            </Source>
        </>
    );
}

/** Haversine distance in meters between two lat/lon points. */
function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
