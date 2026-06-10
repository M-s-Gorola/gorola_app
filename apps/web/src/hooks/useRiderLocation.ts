import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export function useRiderLocation(activeOrderId?: string) {
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!activeOrderId) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("GEOLOCATION_NOT_SUPPORTED");
      return;
    }

    const successHandler = async (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setCoords({ lat, lng });
      try {
        if (api) {
          await api.put("/api/v1/rider/location", {
            lat,
            lng,
            orderId: activeOrderId
          });
        }
      } catch (err) {
        console.error("Failed to send rider location updates:", err);
      }
    };

    const errorHandler = (err: GeolocationPositionError) => {
      if (err.code === 1) {
        setError("LOCATION_DENIED");
      } else {
        setError("LOCATION_ERROR");
      }
    };

    const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    return () => {
      if (typeof navigator !== "undefined" && navigator?.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeOrderId]);

  return { error, coords };
}
