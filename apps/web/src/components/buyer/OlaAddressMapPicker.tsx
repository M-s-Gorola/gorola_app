/* eslint-disable simple-import-sort/imports */
import clsx from "clsx";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { OlaMapInstance, OlaMarkerInstance } from "@/lib/adapters/ola-map-adapter";

export type MapCoordinates = {
  lng: number;
  lat: number;
};

export type OlaAddressMapPickerProps = {
  center: MapCoordinates;
  className?: string;
  onCoordinatesChange: (coords: MapCoordinates) => void;
  zoom?: number;
};

export const MUSSOORIE_AREA_CENTER = {
  lng: 78.0664,
  lat: 30.4598
} satisfies MapCoordinates;

let scriptPromise: Promise<void> | null = null;

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

export function OlaAddressMapPicker({
  center,
  className = "",
  onCoordinatesChange,
  zoom = 13
}: OlaAddressMapPickerProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<OlaMapInstance | null>(null);
  const markerRef = useRef<OlaMarkerInstance | null>(null);
  const onCoordsRef = useRef(onCoordinatesChange);
  onCoordsRef.current = onCoordinatesChange;

  const lastCoordsRef = useRef<MapCoordinates>(center);
  const shouldAutocompleteRef = useRef(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;

  // 1. Fire onCoordinatesChange with default/initial center on mount
  useEffect(() => {
    onCoordsRef.current(center);
  }, []);

  // 2. Autocomplete search query effect with 600ms debounce
  useEffect(() => {
    if (!shouldAutocompleteRef.current) {
      shouldAutocompleteRef.current = true;
      return;
    }

    if (!searchQuery.trim() || !apiKey) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(
          searchQuery
        )}&api_key=${apiKey}&location=${center.lat},${center.lng}&radius=80000`;
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.predictions || []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error during autocomplete fetch:", err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, apiKey, center.lat, center.lng]);

  // 3. Initialize map & marker
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;

    let active = true;

    const initMap = async () => {
      try {
        await loadOlaSdk();
        if (!active || !containerRef.current) return;

        const OlaMaps = window.OlaMaps;
        if (!OlaMaps) {
          console.error("OlaMaps SDK is not loaded on window context");
          return;
        }

        const olaMapsInstance = new OlaMaps({ apiKey });
        const map = olaMapsInstance.init({
          container: containerRef.current,
          center: [center.lng, center.lat],
          zoom,
          style: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
          scrollZoom: false,
          attributionControl: false
        });

        mapRef.current = map;

        // Enable scrollZoom immediately if already hovered during init
        if (containerRef.current?.matches(":hover") && map.scrollZoom) {
          map.scrollZoom.enable();
        }

        // Custom marker element
        const markerEl = document.createElement("div");
        markerEl.style.width = "40px";
        markerEl.style.height = "40px";
        markerEl.style.backgroundImage = "url('/buyer.png')";
        markerEl.style.backgroundSize = "contain";
        markerEl.style.backgroundRepeat = "no-repeat";
        markerEl.style.filter = "drop-shadow(0px 2px 6px rgba(0,0,0,0.5)) saturate(2) contrast(1.2)";

        const marker = new OlaMaps.Marker({
          element: markerEl,
          draggable: true,
          anchor: "bottom"
        })
          .setLngLat([center.lng, center.lat])
          .addTo(map);

        markerRef.current = marker;

        // Emit coords on dragend
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const coords = Array.isArray(lngLat)
            ? { lng: lngLat[0], lat: lngLat[1] }
            : { lng: lngLat.lng, lat: lngLat.lat };
          lastCoordsRef.current = coords;
          onCoordsRef.current(coords);
        });

      } catch (err) {
        console.error("Failed to initialize Ola Map in Address Picker:", err);
      }
    };

    initMap();

    return () => {
      active = false;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [apiKey, zoom]);

  // 4. Scroll zoom activation on hover (preventing propagation)
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let hovered = node.matches(":hover");

    const handleMouseEnter = () => {
      hovered = true;
      if (mapRef.current && mapRef.current.scrollZoom) {
        mapRef.current.scrollZoom.enable();
      }
    };

    const handleMouseLeave = () => {
      hovered = false;
      if (mapRef.current && mapRef.current.scrollZoom) {
        mapRef.current.scrollZoom.disable();
      }
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

    return () => {
      node.removeEventListener("mouseenter", handleMouseEnter);
      node.removeEventListener("mouseleave", handleMouseLeave);
      node.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // 5. Update map center and marker when center prop changes
  useEffect(() => {
    if (!mapRef.current) return;

    const diffLat = Math.abs(lastCoordsRef.current.lat - center.lat);
    const diffLng = Math.abs(lastCoordsRef.current.lng - center.lng);

    if (diffLat > 0.00001 || diffLng > 0.00001) {
      const coords = { lat: center.lat, lng: center.lng };
      lastCoordsRef.current = coords;
      mapRef.current.setCenter([coords.lng, coords.lat]);
      if (markerRef.current) {
        markerRef.current.setLngLat([coords.lng, coords.lat]);
      }
    }
  }, [center.lat, center.lng]);

  // Handle suggestion click
  const handleSuggestionClick = async (placeId: string, description: string) => {
    if (!apiKey) return;
    try {
      const url = `https://api.olamaps.io/places/v1/details?place_id=${encodeURIComponent(
        placeId
      )}&api_key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        
        let location = null;
        if (data.result?.geometry?.location) {
          location = data.result.geometry.location;
        } else if (data.geometry?.location) {
          location = data.geometry.location;
        } else if (data.result?.location) {
          location = data.result.location;
        } else if (data.location) {
          location = data.location;
        }

        if (location) {
          const latVal = location.lat !== undefined ? location.lat : location.latitude;
          const lngVal = location.lng !== undefined ? location.lng : location.longitude;
          
          if (latVal !== undefined && lngVal !== undefined) {
            const coords = { lat: Number(latVal), lng: Number(lngVal) };
            lastCoordsRef.current = coords;
            
            // Update map and marker positions
            if (mapRef.current) {
              mapRef.current.setCenter([coords.lng, coords.lat]);
              mapRef.current.setZoom(15);
            }
            if (markerRef.current) {
              markerRef.current.setLngLat([coords.lng, coords.lat]);
            }

            // Trigger callback
            onCoordsRef.current(coords);
          }
        }
      }
    } catch (err) {
      console.error("Error during geocoding fetch:", err);
    } finally {
      shouldAutocompleteRef.current = false;
      setSuggestions([]);
      setSearchQuery(description);
    }
  };

  // Guard: missing API key
  if (!apiKey) {
    return (
      <div
        data-testid="map-api-key-missing"
        className="flex h-56 w-full items-center justify-center rounded-xl border border-dashed border-red-300 bg-red-50 text-sm font-medium text-red-600"
      >
        Map could not be loaded — API key missing
      </div>
    );
  }

  return (
    <div className={clsx("relative flex flex-col gap-2 w-full", className)}>
      {/* Autocomplete Input and Dropdown */}
      <div className="relative w-full z-10">
        <input
          data-testid="location-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => {
            shouldAutocompleteRef.current = true;
            setSearchQuery(e.target.value);
          }}
          placeholder="Search location (e.g. Hotel Padmini)"
          className="w-full rounded-lg border border-gorola-pine/20 bg-gorola-fog px-4 py-2 text-sm text-gorola-charcoal outline-none focus:border-gorola-pine"
        />
        {isSearching && (
          <div className="absolute right-3 top-2.5 text-xs text-gorola-slate/50 animate-pulse">
            Searching...
          </div>
        )}
        {suggestions.length > 0 && (
          <ul className="absolute left-0 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gorola-pine/10 bg-gorola-fog shadow-lg z-20">
            {suggestions.map((item, idx) => (
              <li
                key={item.place_id}
                data-testid={`suggestion-${idx}`}
                onClick={() => handleSuggestionClick(item.place_id, item.description)}
                className="cursor-pointer px-4 py-2 text-sm text-gorola-charcoal hover:bg-gorola-pine/5 transition-colors"
              >
                {item.description}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map Element */}
      <div
        ref={containerRef}
        aria-label="Delivery location map"
        className="h-56 w-full overflow-hidden rounded-xl border border-gorola-pine/15 bg-gorola-fog"
      />
    </div>
  );
}
