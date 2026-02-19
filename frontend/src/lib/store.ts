import { create } from "zustand";
import type { VehiclePosition } from "@/lib/types";

/**
 * Global store for real-time bus state.
 *
 * Fed by WebSocket connection to the backend.
 * All map layers read from this store.
 */
interface BusStore {
    /** All live vehicle positions — the fleet snapshot. */
    vehicles: VehiclePosition[];

    /** Timestamp of last update from the backend. */
    lastUpdate: string | null;

    /** Whether the WebSocket is connected. */
    connected: boolean;

    /** Currently selected vehicle (clicked on map). */
    selectedVehicle: VehiclePosition | null;

    /** Currently highlighted route (from vehicle selection). */
    activeRouteId: string | null;

    /** Route shapes GeoJSON FeatureCollection. */
    routeShapes: GeoJSON.FeatureCollection | null;

    /** Whether route shapes have been loaded. */
    shapesLoaded: boolean;

    /** Replace the entire vehicle list (full snapshot). */
    setVehicles: (vehicles: VehiclePosition[]) => void;

    /** Update a single vehicle position (delta update). */
    updateVehicle: (vehicle: VehiclePosition) => void;

    /** Set WebSocket connection status. */
    setConnected: (connected: boolean) => void;

    /** Select a vehicle (clicked on map). */
    selectVehicle: (vehicle: VehiclePosition | null) => void;

    /** Set the active/highlighted route. */
    setActiveRoute: (routeId: string | null) => void;

    /** Store route shapes GeoJSON. */
    setRouteShapes: (geojson: GeoJSON.FeatureCollection) => void;
}

export const useBusStore = create<BusStore>((set, get) => ({
    vehicles: [],
    lastUpdate: null,
    connected: false,
    selectedVehicle: null,
    activeRouteId: null,
    routeShapes: null,
    shapesLoaded: false,

    setVehicles: (vehicles) =>
        set((state) => {
            // If we have a selected vehicle, update it with fresh data
            const selected = state.selectedVehicle;
            let updatedSelected = selected;
            if (selected) {
                const fresh = vehicles.find(
                    (v) => v.vehicle_id === selected.vehicle_id
                );
                updatedSelected = fresh || null;
            }
            return {
                vehicles,
                lastUpdate: new Date().toISOString(),
                selectedVehicle: updatedSelected,
            };
        }),

    updateVehicle: (vehicle) =>
        set((state) => {
            const idx = state.vehicles.findIndex(
                (v) => v.vehicle_id === vehicle.vehicle_id
            );
            if (idx === -1) {
                return { vehicles: [...state.vehicles, vehicle] };
            }
            const updated = [...state.vehicles];
            updated[idx] = vehicle;
            return { vehicles: updated, lastUpdate: new Date().toISOString() };
        }),

    setConnected: (connected) => set({ connected }),

    selectVehicle: (vehicle) =>
        set({
            selectedVehicle: vehicle,
            activeRouteId: vehicle?.route_id || null,
        }),

    setActiveRoute: (routeId) => set({ activeRouteId: routeId }),

    setRouteShapes: (geojson) => set({ routeShapes: geojson, shapesLoaded: true }),
}));
