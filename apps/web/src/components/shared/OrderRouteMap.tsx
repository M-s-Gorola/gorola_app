import clsx from "clsx";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";

import { createMapAdapter } from "../../lib/map-adapter-factory";
import type { MapAdapter, MapProvider } from "../../lib/map-provider";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type OrderRouteMapProps = {
  buyerCoords: Coordinates;
  riderCoords?: Coordinates | null;
  className?: string;
};

export function OrderRouteMap({
  buyerCoords,
  riderCoords,
  className = ""
}: OrderRouteMapProps): ReactElement {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const lastRiderCoordsRef = useRef<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRouteCalculating, setIsRouteCalculating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const node = shellRef.current;
    if (node === null) {
      return undefined;
    }

    const provider = (import.meta.env.VITE_MAP_PROVIDER || "leaflet") as MapProvider;
    const adapter = createMapAdapter(provider);
    adapterRef.current = adapter;
    let active = true;

    if (typeof adapter.setRouteStatusCallback === "function") {
      adapter.setRouteStatusCallback((calculating) => {
        if (active) {
          setIsRouteCalculating(calculating);
        }
      });
    }

    async function initMap() {
      try {
        setError(null);
        await adapter.init(node!, buyerCoords, 14);
        if (!active) return;
        
        adapter.addMarker(buyerCoords, "buyer");
        if (riderCoords) {
          adapter.addMarker(riderCoords, "rider");
          lastRiderCoordsRef.current = riderCoords;
        }
        setIsInitialized(true);
      } catch (err) {
        if (!active) return;
        console.error("Failed to initialize map:", err);
        const errorMessage = err instanceof Error ? err.message : "";
        if (errorMessage.includes("VITE_OLA_MAPS_API_KEY is not configured")) {
          setError("Map could not be loaded — API key missing");
        } else {
          setError("Map could not be loaded");
        }
      }
    }

    let hovered = node.matches(":hover");
    if (hovered) {
      adapter.enableScrollZoom();
    }

    const handleMouseEnter = () => {
      hovered = true;
      adapter.enableScrollZoom();
    };
    const handleMouseLeave = () => {
      hovered = false;
      adapter.disableScrollZoom();
    };
    const handleWheel = (e: WheelEvent) => {
      if (hovered) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    node.addEventListener("mouseenter", handleMouseEnter);
    node.addEventListener("mouseleave", handleMouseLeave);
    node.addEventListener("wheel", handleWheel, { passive: false });

    initMap();

    return () => {
      active = false;
      node.removeEventListener("mouseenter", handleMouseEnter);
      node.removeEventListener("mouseleave", handleMouseLeave);
      node.removeEventListener("wheel", handleWheel);
      adapter.destroy();
      adapterRef.current = null;
      lastRiderCoordsRef.current = null;
      setIsInitialized(false);
    };
  }, [buyerCoords.lat, buyerCoords.lng]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (isInitialized && adapter && riderCoords) {
      if (
        !lastRiderCoordsRef.current ||
        lastRiderCoordsRef.current.lat !== riderCoords.lat ||
        lastRiderCoordsRef.current.lng !== riderCoords.lng
      ) {
        adapter.addMarker(riderCoords, "rider");
        lastRiderCoordsRef.current = riderCoords;
      }
    }
  }, [isInitialized, riderCoords?.lat, riderCoords?.lng]);

  if (error) {
    return (
      <div
        aria-label="Order route map error"
        className={clsx(
          "relative z-0 min-h-[300px] w-full flex items-center justify-center rounded-xl border border-gorola-pine/15 bg-gorola-fog text-gorola-charcoal shadow-inner p-4 text-center font-medium",
          className
        )}
        role="region"
      >
        <div className="flex flex-col items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 text-rose-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <span className="text-sm font-body">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div
        ref={shellRef}
        aria-label="Order route map"
        className={clsx(
          "relative z-0 min-h-[300px] w-full overflow-hidden rounded-xl border border-gorola-pine/15 shadow-inner",
          className
        )}
        role="region"
      />
      {isRouteCalculating && riderCoords && (
        <p
          data-testid="route-calculating-note"
          className="text-xs text-center text-gorola-slate/70 mt-1 italic animate-pulse"
        >
          Calculating route…
        </p>
      )}
    </div>
  );
}
