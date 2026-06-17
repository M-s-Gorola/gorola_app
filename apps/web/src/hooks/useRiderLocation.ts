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

    let receivedLocation = false;

    const successHandler = async (position: GeolocationPosition) => {
      receivedLocation = true;
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
      if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
        console.warn("Geolocation failed or was denied. Using mock rider coordinates in development.");
        void successHandler({
          coords: {
            latitude: 30.3702093 - 0.003,
            longitude: 78.0982018 - 0.003,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        } as GeolocationPosition);
        return;
      }

      if (err.code === 1) {
        setError("LOCATION_DENIED");
      } else {
        setError("LOCATION_ERROR");
      }
    };

    // Fetch current position immediately to fire the first location update instantly
    navigator.geolocation.getCurrentPosition(successHandler, errorHandler, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    // In development mode, mock location updates if no real GPS location is fetched within 2 seconds
    let devTimeout: ReturnType<typeof setTimeout> | undefined;
    if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
      devTimeout = setTimeout(() => {
        if (!receivedLocation) {
          console.warn("No real GPS location received. Using mock rider coordinates in development.");
          void successHandler({
            coords: {
              latitude: 30.3702093 - 0.003,
              longitude: 78.0982018 - 0.003,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          } as GeolocationPosition);
        }
      }, 2000);
    }

    return () => {
      if (typeof navigator !== "undefined" && navigator?.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (devTimeout) {
        clearTimeout(devTimeout);
      }
    };
  }, [activeOrderId]);

  return { error, coords };
}
