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

  /** Replace the entire vehicle list (full snapshot). */
  setVehicles: (vehicles: VehiclePosition[]) => void;

  /** Update a single vehicle position (delta update). */
  updateVehicle: (vehicle: VehiclePosition) => void;

  /** Set WebSocket connection status. */
  setConnected: (connected: boolean) => void;
}

export const useBusStore = create<BusStore>((set) => ({
  vehicles: [],
  lastUpdate: null,
  connected: false,

  setVehicles: (vehicles) =>
    set({
      vehicles,
      lastUpdate: new Date().toISOString(),
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
}));
