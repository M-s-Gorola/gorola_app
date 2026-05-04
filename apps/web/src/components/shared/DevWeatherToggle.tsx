import { CloudMoon,CloudSun } from "lucide-react";

import { useWeatherStore } from "@/store/weather.store";

/**
 * A floating dev-only toggle to test Weather Mode aesthetics.
 * Visible only in development mode.
 */
export function DevWeatherToggle() {
  const { isWeatherMode, toggleWeather } = useWeatherStore();

  if (import.meta.env.PROD) return null;

  return (
    <button
      onClick={toggleWeather}
      className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-gorola-charcoal text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
      title={`Switch to ${isWeatherMode ? "Normal" : "Weather"} Mode`}
    >
      {isWeatherMode ? (
        <CloudSun className="h-5 w-5" />
      ) : (
        <CloudMoon className="h-5 w-5 text-gorola-amber" />
      )}
    </button>
  );
}
