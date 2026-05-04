import { useEffect } from "react";

import { useWeatherStore } from "@/store/weather.store";

const POLL_INTERVAL_MS = 60_000;

/**
 * Hook to sync weather mode from backend every 60s.
 */
export function useWeatherSync(): void {
  const fetchWeatherMode = useWeatherStore((s) => s.fetchWeatherMode);

  useEffect(() => {
    // Initial fetch
    void fetchWeatherMode();

    const interval = setInterval(() => {
      void fetchWeatherMode();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchWeatherMode]);
}
