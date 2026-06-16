/* eslint-disable simple-import-sort/imports */
import L from "leaflet";
import type { LatLngTuple, Map, Marker } from "leaflet";
import type { MapAdapter, MarkerIconType } from "../map-provider";
import { fetchOlaRoute } from "../map-route-helper";
import buyerPng from "../../assets/buyer.png";
import riderPng from "../../assets/rider.png";
import "leaflet/dist/leaflet.css";

export class LeafletMapAdapter implements MapAdapter {
  private _map: Map | null = null;
  private _markers: Marker[] = [];
  private _buyerCoords: { lat: number; lng: number } | null = null;
  private _riderCoords: { lat: number; lng: number } | null = null;
  private _routeLine: L.Polyline | null = null;

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

    setTimeout(() => {
      this._fitBounds();
    }, 350);
  }

  addMarker(coords: { lat: number; lng: number }, icon: MarkerIconType): void {
    if (!this._map) return;

    const leafletIcon = icon === "buyer"
      ? L.icon({
          iconUrl: buyerPng,
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        })
      : L.icon({
          iconUrl: riderPng,
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        });

    const marker = L.marker([coords.lat, coords.lng], { icon: leafletIcon }).addTo(
      this._map
    );
    this._markers.push(marker);

    const element = marker.getElement();
    if (element) {
      element.style.filter = "drop-shadow(0px 2px 6px rgba(0,0,0,0.5)) saturate(2) contrast(1.2)";
    }

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
    if (this._routeLine) {
      this._routeLine.remove();
      this._routeLine = null;
    }
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

    void this._drawRoute();
  }

  private async _drawRoute(): Promise<void> {
    if (!this._map || !this._buyerCoords || !this._riderCoords) return;

    if (this._routeLine) {
      this._routeLine.remove();
    }

    let coords: [number, number][] = [
      [this._riderCoords.lat, this._riderCoords.lng],
      [this._buyerCoords.lat, this._buyerCoords.lng]
    ];

    const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
    if (apiKey) {
      try {
        coords = await fetchOlaRoute(this._riderCoords, this._buyerCoords, apiKey);
      } catch (err) {
        console.warn("Failed to fetch road route, falling back to straight line:", err);
      }
    }

    if (typeof L.polyline === "function") {
      this._routeLine = L.polyline(coords, {
        color: "#1d3d2f",
        weight: 4,
        opacity: 0.8
      }).addTo(this._map);
    }
  }
}
