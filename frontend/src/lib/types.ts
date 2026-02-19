/** Shared types for BusIQ frontend. */

/** The four DBI challenge pillars as UI modes. */
export type PillarMode = "data-viz" | "optimise" | "collab" | "smart-cities";

/** Pillar metadata for the rail switcher. */
export interface PillarInfo {
    id: PillarMode;
    label: string;
    shortLabel: string;
    description: string;
    icon: string;
}

export const PILLARS: PillarInfo[] = [
    {
        id: "data-viz",
        label: "Situational Awareness",
        shortLabel: "LIVE MAP",
        description: "Fleet tracking, health score, route arteries",
        icon: "📊",
    },
    {
        id: "optimise",
        label: "Intervention Engine",
        shortLabel: "INTERVENE",
        description: "Ghost buses, bunching, one-click actions",
        icon: "⚡",
    },
    {
        id: "collab",
        label: "Passenger Intelligence",
        shortLabel: "CROWDSRC",
        description: "Crowding reports, sentiment, community feed",
        icon: "📡",
    },
    {
        id: "smart-cities",
        label: "City Orchestrator",
        shortLabel: "MULTIMODAL",
        description: "Bus + Luas + DART + Bike, carbon dashboard",
        icon: "🏙️",
    },
];

/** Vehicle position from the API. */
export interface VehiclePosition {
    vehicle_id: string;
    route_id: string;
    route_short_name: string;
    trip_id: string | null;
    latitude: number;
    longitude: number;
    bearing: number | null;
    speed_kmh: number | null;
    occupancy_status: string;
    delay_seconds: number;
    timestamp: string;
}

/** Route shape GeoJSON feature properties. */
export interface RouteShapeProperties {
    route_id: string;
    route_short_name: string;
    shape_id: string;
}

/** Route info from the API. */
export interface RouteInfo {
    route_id: string;
    route_short_name: string;
    has_shapes: boolean;
    shape_count: number;
}

/** Standard API response envelope. */
export interface ApiResponse<T> {
    data: T;
    meta: {
        timestamp: string;
        version: string;
    };
}

/** Delay status derived from delay_seconds. */
export type DelayStatus = "on-time" | "slight" | "moderate" | "severe";

export function getDelayStatus(delay: number): DelayStatus {
    if (delay <= 300) return "on-time";
    if (delay <= 600) return "slight";
    if (delay <= 900) return "moderate";
    return "severe";
}

export function formatDelay(seconds: number): string {
    if (Math.abs(seconds) < 60) return "On time";
    const mins = Math.round(seconds / 60);
    if (mins > 0) return `${mins} min late`;
    return `${Math.abs(mins)} min early`;
}
