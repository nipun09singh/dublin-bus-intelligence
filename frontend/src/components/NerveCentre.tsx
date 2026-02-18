"use client";

import { useRef, useCallback, useState } from "react";
import Map, { MapRef, NavigationControl } from "react-map-gl/mapbox";
import { PillarMode } from "@/lib/types";
import PulseRing from "@/components/overlays/PulseRing";
import PillarRail from "@/components/overlays/PillarRail";
import VehicleMarkerLayer from "@/components/layers/VehicleMarkerLayer";

const DUBLIN_CENTER = { latitude: 53.3498, longitude: -6.2603 };
const INITIAL_ZOOM = 12;

/**
 * NerveCentre — the single-canvas interface.
 *
 * The map IS the app. Everything floats over it.
 * Pillar modes transform layers, not routes.
 */
export default function NerveCentre() {
  const mapRef = useRef<MapRef>(null);
  const [activeMode, setActiveMode] = useState<PillarMode>("data-viz");
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* ─── The Map Canvas ─── */}
      <Map
        ref={mapRef}
        initialViewState={{
          ...DUBLIN_CENTER,
          zoom: INITIAL_ZOOM,
          pitch: 0,
          bearing: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        onLoad={handleMapLoad}
        attributionControl={false}
        maxZoom={18}
        minZoom={10}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* ─── Map Layers (z-order matters) ─── */}
        {mapLoaded && (
          <>
            {/* Layer 5: Vehicle markers */}
            <VehicleMarkerLayer activeMode={activeMode} />
          </>
        )}
      </Map>

      {/* ─── Glass Overlays (HTML over map) ─── */}

      {/* Top-left: Pulse Ring — live fleet counter */}
      <PulseRing busCount={0} />

      {/* Bottom: Pillar Rail — mode switcher */}
      <PillarRail activeMode={activeMode} onModeChange={setActiveMode} />
    </div>
  );
}
