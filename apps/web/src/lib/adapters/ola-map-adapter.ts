import type { MapAdapter, MarkerIconType } from "../map-provider";
import { fetchOlaRoute } from "../map-route-helper";

export interface OlaMapInstance {
  remove(): void;
  setCenter(center: [number, number]): void;
  setZoom(zoom: number): void;
  resize(): void;
  fitBounds(bounds: [number, number][], options?: { padding: number; maxZoom?: number }): void;
  on(event: string, listener: () => void): void;
  scrollZoom?: {
    enable(): void;
    disable(): void;
  };
}

export interface OlaMarkerInstance {
  setLngLat(coords: [number, number]): OlaMarkerInstance;
  addTo(map: OlaMapInstance): OlaMarkerInstance;
  remove(): void;
}

export interface OlaMapExtended extends OlaMapInstance {
  getLayer(id: string): unknown;
  removeLayer(id: string): void;
  getSource(id: string): { setData(data: unknown): void } | null | undefined;
  removeSource(id: string): void;
  isStyleLoaded(): boolean;
  addSource(id: string, source: unknown): void;
  addLayer(layer: unknown): void;
}

declare global {
  interface Window {
    OlaMaps?: {
      new (options: { apiKey: string }): {
        init(options: {
          container: HTMLDivElement;
          center: [number, number];
          zoom: number;
          style: string;
          scrollZoom?: boolean;
        }): OlaMapInstance;
      };
      Marker: {
        new (options?: { element?: HTMLDivElement; anchor?: string }): OlaMarkerInstance;
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function resetOlaScriptPromise(): void {
  scriptPromise = null;
}

function loadOlaSdk(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[src="https://www.unpkg.com/olamaps-web-sdk@latest/dist/olamaps-web-sdk.umd.js"]'
    );
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.unpkg.com/olamaps-web-sdk@latest/dist/olamaps-web-sdk.umd.js";
    script.onload = () => resolve();
    script.onerror = (err) => {
      scriptPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export class OlaMapAdapter implements MapAdapter {
  private _map: OlaMapInstance | null = null;
  private _markers: OlaMarkerInstance[] = [];
  private _buyerCoords: { lat: number; lng: number } | null = null;
  private _riderCoords: { lat: number; lng: number } | null = null;
  private _routeSourceId = "route-source";
  private _routeLayerId = "route-layer";

  async init(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number
  ): Promise<void> {
    const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("VITE_OLA_MAPS_API_KEY is not configured");
    }

    await loadOlaSdk();

    const OlaMaps = window.OlaMaps;
    if (!OlaMaps) {
      throw new Error("OlaMaps SDK failed to load onto window global context");
    }

    const olaMapsInstance = new OlaMaps({ apiKey });
    this._map = olaMapsInstance.init({
      container,
      center: [center.lng, center.lat],
      zoom,
      style: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
      scrollZoom: false
    });

    this._map.on("load", () => {
      this._fitBounds();
      setTimeout(() => {
        this._fitBounds();
      }, 350);
    });
  }

  addMarker(coords: { lat: number; lng: number }, icon: MarkerIconType): void {
    if (!this._map) return;

    const OlaMaps = window.OlaMaps;
    if (!OlaMaps) return;

    const markerEl = document.createElement("div");
    const markerOptions: { element: HTMLDivElement; anchor?: string } = { element: markerEl };

    if (icon === "buyer") {
      markerEl.style.width = "40px";
      markerEl.style.height = "40px";
      markerEl.style.backgroundImage = "url('/buyer.png')";
      markerEl.style.backgroundSize = "contain";
      markerEl.style.backgroundRepeat = "no-repeat";
      markerEl.style.filter = "drop-shadow(0px 2px 6px rgba(0,0,0,0.5)) saturate(2) contrast(1.2)";
      markerOptions.anchor = "bottom";
    } else {
      markerEl.style.width = "40px";
      markerEl.style.height = "40px";
      markerEl.style.backgroundImage = "url('/rider.png')";
      markerEl.style.backgroundSize = "contain";
      markerEl.style.backgroundRepeat = "no-repeat";
      markerEl.style.filter = "drop-shadow(0px 2px 6px rgba(0,0,0,0.5)) saturate(2) contrast(1.2)";
      markerOptions.anchor = "bottom";
    }

    const marker = new OlaMaps.Marker(markerOptions)
      .setLngLat([coords.lng, coords.lat])
      .addTo(this._map);

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
      const map = this._map as unknown as OlaMapExtended;
      try {
        if (typeof map.getLayer === "function" && map.getLayer(this._routeLayerId)) {
          map.removeLayer(this._routeLayerId);
        }
        if (typeof map.getSource === "function" && map.getSource(this._routeSourceId)) {
          map.removeSource(this._routeSourceId);
        }
      } catch (err) {
        console.warn("Failed to clean up route source/layer in Ola Maps destroy:", err);
      }
      this._map.remove();
      this._map = null;
    }

    const script = document.querySelector(
      'script[src="https://www.unpkg.com/olamaps-web-sdk@latest/dist/olamaps-web-sdk.umd.js"]'
    );
    if (script) {
      script.remove();
    }
    scriptPromise = null;
  }

  private _fitBounds(): void {
    if (!this._map) return;

    const boundsPoints: [number, number][] = [];
    if (this._buyerCoords) {
      boundsPoints.push([this._buyerCoords.lng, this._buyerCoords.lat]);
    }
    if (this._riderCoords) {
      boundsPoints.push([this._riderCoords.lng, this._riderCoords.lat]);
    }

    this._map.resize();

    if (boundsPoints.length > 1) {
      // If coordinates are identical or extremely close, center on buyer and set zoom to 14
      const dLat = Math.abs(this._buyerCoords!.lat - this._riderCoords!.lat);
      const dLng = Math.abs(this._buyerCoords!.lng - this._riderCoords!.lng);
      if (dLat < 0.0001 && dLng < 0.0001) {
        this._map.setCenter([this._buyerCoords!.lng, this._buyerCoords!.lat]);
        this._map.setZoom(14);
      } else {
        const lngs = boundsPoints.map((p) => p[0]);
        const lats = boundsPoints.map((p) => p[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        this._map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat]
          ],
          { padding: 40, maxZoom: 14 }
        );
      }
    } else if (this._buyerCoords) {
      this._map.setCenter([this._buyerCoords.lng, this._buyerCoords.lat]);
      this._map.setZoom(14);
    }

    void this._drawRoute();
  }

  private async _drawRoute(): Promise<void> {
    if (!this._map || !this._buyerCoords || !this._riderCoords) return;

    const map = this._map as unknown as OlaMapExtended;
    if (typeof map.isStyleLoaded !== "function") return;
    if (!map.isStyleLoaded()) return;

    let roadCoords: [number, number][] = [
      [this._riderCoords.lat, this._riderCoords.lng],
      [this._buyerCoords.lat, this._buyerCoords.lng]
    ];

    const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
    if (apiKey) {
      try {
        roadCoords = await fetchOlaRoute(this._riderCoords, this._buyerCoords, apiKey);
      } catch (err) {
        console.warn("Failed to fetch road route, falling back to straight line:", err);
      }
    }

    // Convert from [lat, lng] to [lng, lat] for GeoJSON
    const geojsonCoords = roadCoords.map((c) => [c[1], c[0]]);

    const geojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: geojsonCoords
      }
    };

    try {
      const source = typeof map.getSource === "function" ? map.getSource(this._routeSourceId) : null;
      if (source) {
        if (typeof source.setData === "function") {
          source.setData(geojson);
        }
      } else {
        if (typeof map.addSource === "function") {
          map.addSource(this._routeSourceId, {
            type: "geojson",
            data: geojson
          });
        }

        if (typeof map.addLayer === "function") {
          map.addLayer({
            id: this._routeLayerId,
            type: "line",
            source: this._routeSourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round"
            },
            paint: {
              "line-color": "#1d3d2f",
              "line-width": 4,
              "line-opacity": 0.8
            }
          });
        }
      }
    } catch (err) {
      console.warn("Failed to draw route in Ola Maps:", err);
    }
  }

  enableScrollZoom(): void {
    if (this._map && this._map.scrollZoom) {
      this._map.scrollZoom.enable();
    }
  }

  disableScrollZoom(): void {
    if (this._map && this._map.scrollZoom) {
      this._map.scrollZoom.disable();
    }
  }
}
