/* eslint-disable simple-import-sort/imports */
import clsx from "clsx";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import type { ReactElement } from "react";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type OrderRouteMapProps = {
  buyerCoords: Coordinates;
  riderCoords?: Coordinates | null;
  className?: string;
};

const buyerIcon = L.divIcon({
  html: `
    <div class="flex items-center justify-center w-8 h-8 rounded-full bg-rose-500 border-2 border-white shadow-md text-white animate-pulse">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
        <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
      </svg>
    </div>
  `,
  className: "custom-buyer-pin",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const riderIcon = L.divIcon({
  html: `
    <div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-md text-white">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
        <path d="M1.5 8.678c0-.754.546-1.387 1.29-1.488l9.75-1.328A1.5 1.5 0 0 1 14.25 7.35v1.272a1.5 1.5 0 0 1-1.076 1.436l-9.75 2.766a1.5 1.5 0 0 1-1.89-1.436V8.678Z" />
        <path d="M21 8.678c0-.754-.546-1.387-1.29-1.488l-9.75-1.328A1.5 1.5 0 0 0 8.25 7.35v1.272a1.5 1.5 0 0 0 1.076 1.436l9.75 2.766A1.5 1.5 0 0 0 21 11.388V8.678Z" />
        <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm0 16.5a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5Z" clip-rule="evenodd" />
      </svg>
    </div>
  `,
  className: "custom-rider-pin",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

export function OrderRouteMap({
  buyerCoords,
  riderCoords,
  className = ""
}: OrderRouteMapProps): ReactElement {
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = shellRef.current;
    if (node === null) {
      return undefined;
    }

    const defaultCenter: LatLngTuple = [buyerCoords.lat, buyerCoords.lng];
    const map = L.map(node, {
      scrollWheelZoom: true,
      zoomControl: true
    }).setView(defaultCenter, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>'
    }).addTo(map);

    // Add buyer marker
    const buyerMarker = L.marker([buyerCoords.lat, buyerCoords.lng], {
      icon: buyerIcon
    }).addTo(map);

    let riderMarker: L.Marker | null = null;
    if (riderCoords) {
      riderMarker = L.marker([riderCoords.lat, riderCoords.lng], {
        icon: riderIcon
      }).addTo(map);
    }

    // Prepare list of coordinates to fit bounds
    const boundsPoints: LatLngTuple[] = [
      [buyerCoords.lat, buyerCoords.lng]
    ];
    if (riderCoords) {
      boundsPoints.push([riderCoords.lat, riderCoords.lng]);
    }
    
    if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [40, 40] });
    } else {
      map.setView(defaultCenter, 14);
    }

    return () => {
      buyerMarker.remove();
      if (riderMarker) {
        riderMarker.remove();
      }
      map.off();
      map.remove();
    };
  }, [
    buyerCoords.lat,
    buyerCoords.lng,
    riderCoords?.lat,
    riderCoords?.lng
  ]);

  return (
    <div
      ref={shellRef}
      aria-label="Order route map"
      className={clsx("relative z-0 min-h-[300px] w-full overflow-hidden rounded-xl border border-gorola-pine/15 shadow-inner", className)}
      role="region"
    />
  );
}
