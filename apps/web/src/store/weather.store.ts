import { create } from "zustand";

import { getFeatureFlag } from "@/lib/api";

type WeatherState = {
  isWeatherMode: boolean;
  isFetching: boolean;
  setWeatherMode: (value: boolean) => void;
  toggleWeather: () => void;
  fetchWeatherMode: () => Promise<void>;
};

export const useWeatherStore = create<WeatherState>((set) => ({
  isWeatherMode: false,
  isFetching: false,
  setWeatherMode: (value) => set({ isWeatherMode: value }),
  toggleWeather: () => set((s) => ({ isWeatherMode: !s.isWeatherMode })),
  fetchWeatherMode: async () => {
    set({ isFetching: true });
    try {
      const value = await getFeatureFlag("WEATHER_MODE_ACTIVE");
      set({ isWeatherMode: value });
    } catch {
      // Default to false on error
      set({ isWeatherMode: false });
    } finally {
      set({ isFetching: false });
    }
  }
}));
