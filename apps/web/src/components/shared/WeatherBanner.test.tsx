/* eslint-disable simple-import-sort/imports -- local + @/ groups conflict with flat import rules */
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useWeatherStore } from "@/store/weather.store";
import { WeatherBanner } from "./WeatherBanner";

describe("WeatherBanner", () => {
  beforeEach(() => {
    act(() => {
      useWeatherStore.getState().setWeatherMode(false);
    });
  });

  it("uses pine styling when not in weather mode", () => {
    render(<WeatherBanner />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("Skies clear");
    expect(el).toHaveAttribute("data-weather", "off");
  });

  it("uses slate copy and background when weather mode is on", () => {
    act(() => {
      useWeatherStore.getState().setWeatherMode(true);
    });
    render(<WeatherBanner />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("Fog tonight");
    expect(el).toHaveAttribute("data-weather", "on");
  });
});
