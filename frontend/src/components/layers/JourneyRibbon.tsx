"use client";

import { useEffect, useRef, useMemo } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type { LineLayerSpecification, CircleLayerSpecification } from "mapbox-gl";

/**
 * JourneyRibbon — animated flowing ribbons on the map for journey segments.
 *
 * Each transport mode has a different colour (design doc Section 5.1.4):
 * - Bus: Forest teal (#00808B)
 * - Luas: Sunset purple (#6B2D8B)
 * - DART: Ocean blue (#0072CE)
 * - Bike: Lime green (#76B82A)
 * - Walk: Warm grey (#8C8C8C)
 *
 * Transfer nodes appear as glowing interchange diamonds.
 * The selected option is opaque; unselected options are faded.
 */

interface Segment {
    mode: string;
    from_lat: number;
    from_lon: number;
    to_lat: number;
    to_lon: number;
    colour: string;
    from_name: string;
    to_name: string;
    real_time_minutes: number | null;
}

interface JourneyOption {
    label: string;
    segments: Segment[];
    total_duration_minutes: number;
}

interface JourneyRibbonProps {
    options: JourneyOption[];
    selectedIdx: number;
}

export default function JourneyRibbon({
    options,
    selectedIdx,
}: JourneyRibbonProps) {
    const animRef = useRef<number>(0);
    const dashRef = useRef<number>(0);

    // Build GeoJSON for all options
    const { lineGeoJSON, nodeGeoJSON } = useMemo(() => {
        const lineFeatures: GeoJSON.Feature[] = [];
        const nodeFeatures: GeoJSON.Feature[] = [];

        options.forEach((opt, optIdx) => {
            const isSelected = optIdx === selectedIdx;

            opt.segments.forEach((seg, segIdx) => {
                // Line feature for this segment
                lineFeatures.push({
                    type: "Feature",
                    properties: {
                        optionIdx: optIdx,
                        segmentIdx: segIdx,
                        mode: seg.mode,
                        colour: seg.colour,
                        isSelected,
                        opacity: isSelected ? 0.9 : 0.25,
                        width: isSelected ? 5 : 2,
                    },
                    geometry: {
                        type: "LineString",
                        coordinates: _interpolateLine(
                            seg.from_lon,
                            seg.from_lat,
                            seg.to_lon,
                            seg.to_lat,
                            optIdx, // slight offset for parallel ribbons
                            options.length,
                        ),
                    },
                });

                // Transfer nodes at segment boundaries (except first start / last end)
                if (segIdx > 0) {
                    nodeFeatures.push({
                        type: "Feature",
                        properties: {
                            name: seg.from_name,
                            mode: seg.mode,
                            isSelected,
                            rtMinutes: seg.real_time_minutes,
                            urgent: seg.real_time_minutes !== null && seg.real_time_minutes <= 2,
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [seg.from_lon, seg.from_lat],
                        },
                    });
                }
            });

            // Origin + destination markers for selected option
            if (isSelected && opt.segments.length > 0) {
                const first = opt.segments[0];
                const last = opt.segments[opt.segments.length - 1];

                nodeFeatures.push({
                    type: "Feature",
                    properties: {
                        name: first.from_name,
                        mode: "origin",
                        isSelected: true,
                        rtMinutes: null,
                        urgent: false,
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [first.from_lon, first.from_lat],
                    },
                });
                nodeFeatures.push({
                    type: "Feature",
                    properties: {
                        name: last.to_name,
                        mode: "destination",
                        isSelected: true,
                        rtMinutes: null,
                        urgent: false,
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [last.to_lon, last.to_lat],
                    },
                });
            }
        });

        return {
            lineGeoJSON: {
                type: "FeatureCollection" as const,
                features: lineFeatures,
            },
            nodeGeoJSON: {
                type: "FeatureCollection" as const,
                features: nodeFeatures,
            },
        };
    }, [options, selectedIdx]);

    // Ribbon line style — colour per segment
    const ribbonLineStyle: LineLayerSpecification = {
        id: "journey-ribbons",
        type: "line",
        source: "journey-lines",
        paint: {
            "line-color": ["get", "colour"],
            "line-width": ["get", "width"],
            "line-opacity": ["get", "opacity"],
            "line-dasharray": [2, 2],
        },
        layout: {
            "line-cap": "round",
            "line-join": "round",
        },
    };

    // Glow layer (underneath, wider, lower opacity)
    const ribbonGlowStyle: LineLayerSpecification = {
        id: "journey-ribbons-glow",
        type: "line",
        source: "journey-lines",
        paint: {
            "line-color": ["get", "colour"],
            "line-width": ["+", ["get", "width"], 6],
            "line-opacity": ["*", ["get", "opacity"], 0.2],
            "line-blur": 6,
        },
        layout: {
            "line-cap": "round",
            "line-join": "round",
        },
    };

    // Transfer node style — glowing interchange diamonds
    const nodeStyle: CircleLayerSpecification = {
        id: "journey-nodes",
        type: "circle",
        source: "journey-nodes",
        paint: {
            "circle-radius": [
                "case",
                ["==", ["get", "mode"], "origin"], 8,
                ["==", ["get", "mode"], "destination"], 8,
                6,
            ],
            "circle-color": [
                "case",
                ["==", ["get", "mode"], "origin"], "#22d3ee",
                ["==", ["get", "mode"], "destination"], "#f97316",
                ["==", ["get", "urgent"], true], "#ef4444",
                "#ffffff",
            ],
            "circle-opacity": [
                "case",
                ["get", "isSelected"], 0.9,
                0.3,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#000",
            "circle-stroke-opacity": 0.5,
        },
        filter: ["==", ["get", "isSelected"], true],
    };

    // Node glow for urgent transfers (<2 min)
    const nodeGlowStyle: CircleLayerSpecification = {
        id: "journey-nodes-glow",
        type: "circle",
        source: "journey-nodes",
        paint: {
            "circle-radius": 14,
            "circle-color": "#ef4444",
            "circle-opacity": 0.3,
            "circle-blur": 1,
        },
        filter: [
            "all",
            ["==", ["get", "urgent"], true],
            ["==", ["get", "isSelected"], true],
        ],
    };

    return (
        <>
            <Source id="journey-lines" type="geojson" data={lineGeoJSON}>
                <Layer {...ribbonGlowStyle} />
                <Layer {...ribbonLineStyle} />
            </Source>
            <Source id="journey-nodes" type="geojson" data={nodeGeoJSON}>
                <Layer {...nodeGlowStyle} />
                <Layer {...nodeStyle} />
            </Source>
        </>
    );
}

/**
 * Interpolate between two points with slight offset for parallel ribbons.
 * Creates a gentle curve (via midpoint offset) so overlapping routes
 * fan out visually.
 */
function _interpolateLine(
    lon1: number,
    lat1: number,
    lon2: number,
    lat2: number,
    optionIdx: number,
    totalOptions: number,
): [number, number][] {
    const midLon = (lon1 + lon2) / 2;
    const midLat = (lat1 + lat2) / 2;

    // Offset perpendicular to the line for parallel ribbons
    const dx = lon2 - lon1;
    const dy = lat2 - lat1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) return [[lon1, lat1], [lon2, lat2]];

    // Perpendicular unit vector
    const px = -dy / len;
    const py = dx / len;

    // Offset: center the ribbons around the midpoint
    const spread = 0.0008; // degrees offset
    const centerOffset = (optionIdx - (totalOptions - 1) / 2) * spread;

    const ctrlLon = midLon + px * centerOffset;
    const ctrlLat = midLat + py * centerOffset;

    // Generate quadratic bezier points
    const points: [number, number][] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const x = u * u * lon1 + 2 * u * t * ctrlLon + t * t * lon2;
        const y = u * u * lat1 + 2 * u * t * ctrlLat + t * t * lat2;
        points.push([x, y]);
    }
    return points;
}
