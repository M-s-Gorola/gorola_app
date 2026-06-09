import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export function useRiderLocation(activeOrderId?: string) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrderId) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("GEOLOCATION_NOT_SUPPORTED");
      return;
    }

    const successHandler = async (position: GeolocationPosition) => {
      try {
        if (api) {
          await api.put("/api/v1/rider/location", {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
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

  return { error };
}
