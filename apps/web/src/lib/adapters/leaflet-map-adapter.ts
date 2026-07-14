/* eslint-disable simple-import-sort/imports */
import L from "leaflet";
import type { LatLngTuple, Map, Marker } from "leaflet";
import type { MapAdapter, MarkerIconType } from "../map-provider";
import { fetchOlaRoute } from "../map-route-helper";
import "leaflet/dist/leaflet.css";

export class LeafletMapAdapter implements MapAdapter {
  private _map: Map | null = null;
  private _markers: Marker[] = [];
  private _buyerMarker: Marker | null = null;
  private _riderMarker: Marker | null = null;
  private _buyerCoords: { lat: number; lng: number } | null = null;
  private _riderCoords: { lat: number; lng: number } | null = null;
  private _routeLine: L.Polyline | null = null;
  private _placeholderLine: L.Polyline | null = null;
  private _routeStatusCallback: ((calculating: boolean) => void) | null = null;

  async init(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number
  ): Promise<void> {
    const defaultCenter: LatLngTuple = [center.lat, center.lng];
    this._map = L.map(container, {
      scrollWheelZoom: false,
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

  setRouteStatusCallback(cb: (calculating: boolean) => void): void {
    this._routeStatusCallback = cb;
  }

  addMarker(coords: { lat: number; lng: number }, icon: MarkerIconType): void {
    if (!this._map) return;

    if (icon === "buyer") {
      this._buyerCoords = coords;
    } else {
      this._riderCoords = coords;
    }

    const isTogether = this._buyerCoords !== null && this._riderCoords !== null &&
      Math.abs(this._buyerCoords.lat - this._riderCoords.lat) < 0.00015 &&
      Math.abs(this._buyerCoords.lng - this._riderCoords.lng) < 0.00015;

    const buyerIcon = isTogether
      ? L.icon({
          iconUrl: "/buyer.png",
          iconSize: [24, 24],
          iconAnchor: [26, 24]
        })
      : L.icon({
          iconUrl: "/buyer.png",
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        });

    const riderIcon = isTogether
      ? L.icon({
          iconUrl: "/rider.png",
          iconSize: [24, 24],
          iconAnchor: [-2, 24]
        })
      : L.icon({
          iconUrl: "/rider.png",
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        });

    if (icon === "buyer") {
      if (this._buyerMarker) {
        this._buyerMarker.setLatLng([coords.lat, coords.lng]);
      } else {
        this._buyerMarker = L.marker([coords.lat, coords.lng], { icon: buyerIcon }).addTo(
          this._map
        );
        this._markers.push(this._buyerMarker);
        const element = this._buyerMarker.getElement();
        if (element) {
          element.style.filter = "drop-shadow(0px 2px 6px rgba(0,0,0,0.5)) saturate(2) contrast(1.2)";
        }
      }
    } else {
      if (this._riderMarker) {
        this._riderMarker.setLatLng([coords.lat, coords.lng]);
      } else {
        this._riderMarker = L.marker([coords.lat, coords.lng], { icon: riderIcon }).addTo(
          this._map
        );
        this._markers.push(this._riderMarker);
        const element = this._riderMarker.getElement();
        if (element) {
          element.style.filter = "drop-shadow(0px 2px 6px rgba(0,0,0,0.5)) saturate(2) contrast(1.2)";
        }
      }
    }

    if (this._buyerMarker) {
      this._buyerMarker.setIcon(buyerIcon);
    }
    if (this._riderMarker) {
      this._riderMarker.setIcon(riderIcon);
    }

    this._fitBounds();
  }

  destroy(): void {
    if (this._buyerMarker) {
      this._buyerMarker.remove();
      this._buyerMarker = null;
    }
    if (this._riderMarker) {
      this._riderMarker.remove();
      this._riderMarker = null;
    }
    this._markers = [];
    if (this._routeLine) {
      this._routeLine.remove();
      this._routeLine = null;
    }
    if (this._placeholderLine) {
      this._placeholderLine.remove();
      this._placeholderLine = null;
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

    const isTogether = Math.abs(this._buyerCoords.lat - this._riderCoords.lat) < 0.00015 &&
      Math.abs(this._buyerCoords.lng - this._riderCoords.lng) < 0.00015;

    if (isTogether) {
      if (this._placeholderLine) {
        this._placeholderLine.remove();
        this._placeholderLine = null;
      }
      if (this._routeLine) {
        this._routeLine.remove();
        this._routeLine = null;
      }
      this._routeStatusCallback?.(false);
      return;
    }

    // Only draw placeholder line if we don't already have a route line
    if (!this._routeLine) {
      if (this._placeholderLine) {
        this._placeholderLine.remove();
        this._placeholderLine = null;
      }

      // Draw placeholder curved line immediately
      const midLat = (this._riderCoords.lat + this._buyerCoords.lat) / 2 + Math.abs(this._riderCoords.lat - this._buyerCoords.lat) * 0.3;
      const midLng = (this._riderCoords.lng + this._buyerCoords.lng) / 2;

      if (typeof L.polyline === "function") {
        this._placeholderLine = L.polyline([
          [this._riderCoords.lat, this._riderCoords.lng],
          [midLat, midLng],
          [this._buyerCoords.lat, this._buyerCoords.lng]
        ], {
          color: "#1d3d2f",
          weight: 3,
          opacity: 0.7,
          dashArray: "6 8"
        }).addTo(this._map);
      }
    }

    this._routeStatusCallback?.(true);

    const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
    if (apiKey) {
      try {
        const roadCoords = await fetchOlaRoute(this._riderCoords, this._buyerCoords, apiKey);
        if (this._placeholderLine) {
          this._placeholderLine.remove();
          this._placeholderLine = null;
        }
        if (this._routeLine) {
          this._routeLine.remove();
          this._routeLine = null;
        }
        if (typeof L.polyline === "function") {
          this._routeLine = L.polyline(roadCoords, {
            color: "#1d3d2f",
            weight: 4,
            opacity: 0.8
          }).addTo(this._map);
        }
        this._routeStatusCallback?.(false);
        return;
      } catch (err) {
        console.warn("Failed to fetch road route, keeping curved dotted fallback:", err);
      }
    }

    // Fallback: if no API key or API call fails, keep placeholder/dotted curved line
    this._routeStatusCallback?.(false);
  }

  enableScrollZoom(): void {
    this._map?.scrollWheelZoom.enable();
  }

  disableScrollZoom(): void {
    this._map?.scrollWheelZoom.disable();
  }
}
