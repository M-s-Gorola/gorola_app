import { useEffect, useState } from "react";

export interface BuyerLocation {
  locationLabel: string;
  isLoading: boolean;
  coords: { lat: number; lng: number } | null;
  error: string | null;
  refetch: () => void;
}

export function useBuyerLocation(): BuyerLocation {
  const [locationLabel, setLocationLabel] = useState("Mussoorie");
  const [isLoading, setIsLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggerCount, setTriggerCount] = useState(0);

  const refetch = (): void => {
    setTriggerCount((c) => c + 1);
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("GEOLOCATION_UNSUPPORTED");
      setLocationLabel("Mussoorie");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });

        if (!apiKey) {
          setLocationLabel("Mussoorie");
          setIsLoading(false);
          return;
        }

        try {
          const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${apiKey}`;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Reverse geocode failed: ${response.status}`);
          }
          const data = await response.json();
          const firstResult = data.results?.[0];
          if (!firstResult) {
            throw new Error("No address results found");
          }

          let sublocality = "";
          let locality = "";

          const components = firstResult.address_components || [];
          for (const comp of components) {
            if (comp.types?.includes("sublocality") || comp.types?.some((t: string) => t.startsWith("sublocality"))) {
              sublocality = comp.long_name;
            }
            if (comp.types?.includes("locality")) {
              locality = comp.long_name;
            }
          }

          if (sublocality && locality) {
            setLocationLabel(`${sublocality}, ${locality}`);
          } else if (locality) {
            setLocationLabel(locality);
          } else if (sublocality) {
            setLocationLabel(sublocality);
          } else {
            setLocationLabel("Mussoorie");
          }
        } catch (err) {
          console.error("[useBuyerLocation] Reverse geocoding error:", err);
          setError("GEOCODE_ERROR");
          setLocationLabel("Mussoorie");
        } finally {
          setIsLoading(false);
        }
      },
      (geoError) => {
        console.error("[useBuyerLocation] Geolocation error:", geoError);
        if (geoError.code === 1) {
          setError("PERMISSION_DENIED");
        } else if (geoError.code === 2) {
          setError("POSITION_UNAVAILABLE");
        } else if (geoError.code === 3) {
          setError("TIMEOUT");
        } else {
          setError("GEOLOCATION_ERROR");
        }
        setLocationLabel("Mussoorie");
        setIsLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }, [triggerCount]);

  return { locationLabel, isLoading, coords, error, refetch };
}
