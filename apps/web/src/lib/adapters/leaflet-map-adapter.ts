/* eslint-disable simple-import-sort/imports */
import L from "leaflet";
import type { LatLngTuple, Map, Marker } from "leaflet";
import type { MapAdapter, MarkerIconType } from "../map-provider";
import "leaflet/dist/leaflet.css";

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

export class LeafletMapAdapter implements MapAdapter {
  private _map: Map | null = null;
  private _markers: Marker[] = [];
  private _buyerCoords: { lat: number; lng: number } | null = null;
  private _riderCoords: { lat: number; lng: number } | null = null;

  async init(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number
  ): Promise<void> {
    const defaultCenter: LatLngTuple = [center.lat, center.lng];
    this._map = L.map(container, {
      scrollWheelZoom: true,
      zoomControl: true
    }).setView(defaultCenter, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>'
    }).addTo(this._map);
  }

  addMarker(coords: { lat: number; lng: number }, icon: MarkerIconType): void {
    if (!this._map) return;

    const leafletIcon = icon === "buyer" ? buyerIcon : riderIcon;
    const marker = L.marker([coords.lat, coords.lng], { icon: leafletIcon }).addTo(
      this._map
    );
    this._markers.push(marker);

    if (icon === "buyer") {
      this._buyerCoords = coords;
    } else {
      this._riderCoords = coords;
    }

    this._fitBounds();
  }

  destroy(): void {
    this._markers.forEach((m) => m.remove());
    this._markers = [];
    if (this._map) {
      this._map.off();
      this._map.remove();
      this._map = null;
    }
  }

  private _fitBounds(): void {
    if (!this._map) return;

    const boundsPoints: LatLngTuple[] = [];
    if (this._buyerCoords) {
      boundsPoints.push([this._buyerCoords.lat, this._buyerCoords.lng]);
    }
    if (this._riderCoords) {
      boundsPoints.push([this._riderCoords.lat, this._riderCoords.lng]);
    }

    if (boundsPoints.length > 1) {
      this._map.fitBounds(boundsPoints, { padding: [40, 40] });
    } else if (this._buyerCoords) {
      this._map.setView([this._buyerCoords.lat, this._buyerCoords.lng], 14);
    }
  }
}
