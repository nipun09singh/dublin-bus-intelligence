/** Shared types for BusIQ frontend. */

/** The four DBI challenge pillars as UI modes. */
export type PillarMode = "data-viz" | "optimise" | "collab" | "smart-cities";

/** Pillar metadata for the rail switcher. */
export interface PillarInfo {
  id: PillarMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const PILLARS: PillarInfo[] = [
  {
    id: "data-viz",
    label: "Data & Visualisation",
    shortLabel: "DATA & VIZ",
    description: "Live fleet map, demand heatmap, route health",
  },
  {
    id: "optimise",
    label: "Optimisation",
    shortLabel: "OPTIMISE",
    description: "Predictive ETAs, ghost bus detection, bunching alerts",
  },
  {
    id: "collab",
    label: "Collaboration",
    shortLabel: "COLLAB",
    description: "Crowdsourced crowding, accessibility reporting",
  },
  {
    id: "smart-cities",
    label: "Smart Cities",
    shortLabel: "SMART CITIES",
    description: "Multimodal journey planner, carbon tracker",
  },
];

/** Vehicle position from the API. */
export interface VehiclePosition {
  vehicle_id: string;
  route_id: string;
  trip_id: string | null;
  latitude: number;
  longitude: number;
  bearing: number | null;
  speed_kmh: number | null;
  occupancy_status: string;
  delay_seconds: number;
  timestamp: string;
}

/** Standard API response envelope. */
export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    version: string;
  };
}
