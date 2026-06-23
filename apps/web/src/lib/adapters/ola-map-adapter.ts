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
  on(event: string, listener: () => void): void;
  getLngLat(): { lng: number; lat: number };
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
          attributionControl?: boolean;
        }): OlaMapInstance;
      };
      Marker: {
        new (options?: { element?: HTMLDivElement; anchor?: string; draggable?: boolean }): OlaMarkerInstance;
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function resetOlaScriptPromise(): void {
  scriptPromise = null;
}

function loadOlaSdk(): Promise<void> {
  if (window.OlaMaps) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[src="https://www.unpkg.com/olamaps-web-sdk@latest/dist/olamaps-web-sdk.umd.js"]'
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.OlaMaps) {
        resolve();
        return;
      }
      const handleLoad = () => {
        cleanup();
        resolve();
      };
      const handleError = (err: unknown) => {
        cleanup();
        scriptPromise = null;
        reject(err);
      };
      const cleanup = () => {
        existingScript.removeEventListener("load", handleLoad);
        existingScript.removeEventListener("error", handleError);
      };
      existingScript.addEventListener("load", handleLoad);
      existingScript.addEventListener("error", handleError);
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
  private _buyerMarker: OlaMarkerInstance | null = null;
  private _riderMarker: OlaMarkerInstance | null = null;
  private _buyerCoords: { lat: number; lng: number } | null = null;
  private _riderCoords: { lat: number; lng: number } | null = null;
  private _routeSourceId = "route-source";
  private _routeLayerId = "route-layer";
  private _routePlaceholderSourceId = "route-placeholder-source";
  private _routePlaceholderLayerId = "route-placeholder-layer";
  private _routeStatusCallback: ((calculating: boolean) => void) | null = null;

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
      scrollZoom: false,
      attributionControl: true // [WATERMARK-CONTROL] Set false to hide Ola Maps attribution (requires white-label licence).
    });

    return new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      this._map!.on("load", () => {
        this._fitBounds();
        setTimeout(() => {
          this._fitBounds();
        }, 350);
        done();
      });

      // Fallback timeout to prevent hanging in tests or slow network/style loads
      setTimeout(done, 100);
    });
  }

  setRouteStatusCallback(cb: (calculating: boolean) => void): void {
    this._routeStatusCallback = cb;
  }

  addMarker(coords: { lat: number; lng: number }, icon: MarkerIconType): void {
    if (!this._map) return;

    const OlaMaps = window.OlaMaps;
    if (!OlaMaps) return;

    if (icon === "buyer") {
      this._buyerCoords = coords;
      if (this._buyerMarker) {
        this._buyerMarker.setLngLat([coords.lng, coords.lat]);
      } else {
        const markerEl = document.createElement("div");
        markerEl.style.width = "40px";
        markerEl.style.height = "40px";
        markerEl.style.backgroundImage = "url('/buyer.png')";
        markerEl.style.backgroundSize = "contain";
        markerEl.style.backgroundRepeat = "no-repeat";
        markerEl.style.filter = "drop-shadow(0px 2px 6px rgba(0,0,0,0.5)) saturate(2) contrast(1.2)";

        this._buyerMarker = new OlaMaps.Marker({ element: markerEl, anchor: "bottom" })
          .setLngLat([coords.lng, coords.lat])
          .addTo(this._map);
        this._markers.push(this._buyerMarker);
      }
    } else {
      this._riderCoords = coords;
      if (this._riderMarker) {
        this._riderMarker.setLngLat([coords.lng, coords.lat]);
      } else {
        const markerEl = document.createElement("div");
        markerEl.style.width = "40px";
        markerEl.style.height = "40px";
        markerEl.style.backgroundImage = "url('/rider.png')";
        markerEl.style.backgroundSize = "contain";
        markerEl.style.backgroundRepeat = "no-repeat";
        markerEl.style.filter = "drop-shadow(0px 2px 6px rgba(0,0,0,0.5)) saturate(2) contrast(1.2)";

        this._riderMarker = new OlaMaps.Marker({ element: markerEl, anchor: "bottom" })
          .setLngLat([coords.lng, coords.lat])
          .addTo(this._map);
        this._markers.push(this._riderMarker);
      }
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
    if (this._map) {
      const map = this._map as unknown as OlaMapExtended;
      try {
        if (typeof map.getLayer === "function") {
          if (map.getLayer(this._routeLayerId)) {
            map.removeLayer(this._routeLayerId);
          }
          if (map.getLayer(this._routePlaceholderLayerId)) {
            map.removeLayer(this._routePlaceholderLayerId);
          }
        }
        if (typeof map.getSource === "function") {
          if (map.getSource(this._routeSourceId)) {
            map.removeSource(this._routeSourceId);
          }
          if (map.getSource(this._routePlaceholderSourceId)) {
            map.removeSource(this._routePlaceholderSourceId);
          }
        }
      } catch (err) {
        console.warn("Failed to clean up route source/layer in Ola Maps destroy:", err);
      }
      this._map.remove();
      this._map = null;
    }
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

    // Clean up solid route if exists
    try {
      if (typeof map.getLayer === "function" && map.getLayer(this._routeLayerId)) {
        map.removeLayer(this._routeLayerId);
      }
      if (typeof map.getSource === "function" && map.getSource(this._routeSourceId)) {
        map.removeSource(this._routeSourceId);
      }
    } catch {
      // ignore
    }

    // Draw placeholder curved line immediately
    const midLat = (this._riderCoords.lat + this._buyerCoords.lat) / 2 + Math.abs(this._riderCoords.lat - this._buyerCoords.lat) * 0.3;
    const midLng = (this._riderCoords.lng + this._buyerCoords.lng) / 2;

    const placeholderGeojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [this._riderCoords.lng, this._riderCoords.lat],
          [midLng, midLat],
          [this._buyerCoords.lng, this._buyerCoords.lat]
        ]
      }
    };

    try {
      const placeholderSource = typeof map.getSource === "function" ? map.getSource(this._routePlaceholderSourceId) : null;
      if (placeholderSource) {
        if (typeof placeholderSource.setData === "function") {
          placeholderSource.setData(placeholderGeojson);
        }
      } else {
        if (typeof map.addSource === "function") {
          map.addSource(this._routePlaceholderSourceId, {
            type: "geojson",
            data: placeholderGeojson
          });
        }
        if (typeof map.addLayer === "function") {
          map.addLayer({
            id: this._routePlaceholderLayerId,
            type: "line",
            source: this._routePlaceholderSourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round"
            },
            paint: {
              "line-color": "#1d3d2f",
              "line-width": 3,
              "line-opacity": 0.7,
              "line-dasharray": [2, 4]
            }
          });
        }
      }
    } catch (err) {
      console.warn("Failed to draw placeholder route in Ola Maps:", err);
    }

    this._routeStatusCallback?.(true);

    const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
    if (apiKey) {
      try {
        const roadCoords = await fetchOlaRoute(this._riderCoords, this._buyerCoords, apiKey);
        
        // Remove placeholder layer and source before rendering the solid road path
        try {
          if (typeof map.getLayer === "function" && map.getLayer(this._routePlaceholderLayerId)) {
            map.removeLayer(this._routePlaceholderLayerId);
          }
          if (typeof map.getSource === "function" && map.getSource(this._routePlaceholderSourceId)) {
            map.removeSource(this._routePlaceholderSourceId);
          }
        } catch {
          // ignore
        }

        const geojsonCoords = roadCoords.map((c) => [c[1], c[0]]);
        const geojson = {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: geojsonCoords
          }
        };

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
        
        this._routeStatusCallback?.(false);
        return;
      } catch (err) {
        console.warn("Failed to fetch road route, keeping curved dotted fallback:", err);
      }
    }

    // Fallback: keep placeholder layer/source as permanent fallback
    this._routeStatusCallback?.(false);
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
