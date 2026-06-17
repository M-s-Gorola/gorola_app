/* eslint-disable simple-import-sort/imports */
import clsx from "clsx";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import markerIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import type { ReactElement } from "react";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

/** 
 * Fix for Leaflet default icon paths in Vite.
 * By explicitly setting these, we avoid 404s for the blue marker pin.
 */
const DefaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export type MapCoordinates = {
  lng: number;
  lat: number;
};

export type AddressMapPickerProps = {
  center: MapCoordinates;
  className?: string;
  onCoordinatesChange: (coords: MapCoordinates) => void;
  zoom?: number;
};

/** Approximate hills center for Mussoorie area — draggable pin defaults here */
export const MUSSOORIE_AREA_CENTER = {
  lng: 78.066,
  lat: 30.455
} satisfies MapCoordinates;

/**
 * @deprecated Use OlaAddressMapPicker instead. Retained for Leaflet fallback if needed.
 */
export function AddressMapPicker({
  center,
  className = "",
  onCoordinatesChange,
  zoom = 16
}: AddressMapPickerProps): ReactElement {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onCoordsRef = useRef(onCoordinatesChange);
  onCoordsRef.current = onCoordinatesChange;

  useEffect(() => {
    const node = shellRef.current;
    if (node === null) {
      return undefined;
    }
    const viewCenter: LatLngTuple = [center.lat, center.lng];
    const map = L.map(node, {
      scrollWheelZoom: true,
      zoomControl: true
    }).setView(viewCenter, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>'
    }).addTo(map);

    const marker = L.marker([center.lat, center.lng], {
      draggable: true,
      keyboard: false
    }).addTo(map);

    const emitCoords = (): void => {
      const pos = marker.getLatLng();
      onCoordsRef.current({ lat: pos.lat, lng: pos.lng });
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    node.addEventListener("wheel", handleWheel, { passive: false });

    emitCoords();

    marker.on("dragend", emitCoords);

    return () => {
      node.removeEventListener("wheel", handleWheel);
      marker.off("dragend", emitCoords);
      marker.remove();
      map.off();
      map.remove();
    };
    /* Intentionally omitting onCoordinatesChange from deps: parent should wrap in useCallback */
  }, [center.lat, center.lng, zoom]);

  return (
    <div
      ref={shellRef}
      aria-label="Delivery location map"
      className={clsx("min-h-56 w-full overflow-hidden rounded-xl border border-gorola-pine/15", className)}
      role="region"
    />
  );
}
