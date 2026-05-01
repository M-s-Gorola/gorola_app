/* eslint-disable simple-import-sort/imports -- local + @/ groups conflict with flat import rules */
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWeatherStore } from "@/store/weather.store";
import { HeroSection } from "./HeroSection";

const { revertSpy, contextSpy } = vi.hoisted(() => {
  const localRevertSpy = vi.fn();
  const localContextSpy = vi.fn(() => ({ revert: localRevertSpy }));
  return {
    revertSpy: localRevertSpy,
    contextSpy: localContextSpy
  };
});

vi.mock("gsap", () => ({
  default: {
    context: contextSpy,
    timeline: vi.fn(() => ({
      fromTo: vi.fn().mockReturnThis()
    }))
  }
}));

describe("HeroSection", () => {
  beforeEach(() => {
    revertSpy.mockClear();
    contextSpy.mockClear();
    act(() => {
      useWeatherStore.getState().setWeatherMode(false);
    });
  });

  it("renders normal mode copy and CTA", () => {
    render(<HeroSection />);

    expect(screen.getByText("GoRola")).toBeInTheDocument();
    expect(screen.getByText("Mussoorie, delivered.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shop Now" })).toBeInTheDocument();
    expect(screen.getByText(/ETA/i)).toBeInTheDocument();
  });

  it("renders weather mode message and calm ETA copy", () => {
    act(() => {
      useWeatherStore.getState().setWeatherMode(true);
    });

    render(<HeroSection />);

    expect(screen.getByText("Fog tonight — we're still coming")).toBeInTheDocument();
    expect(screen.getByText("Scheduled delivery window tonight")).toBeInTheDocument();
  });

  it("reverts gsap context on unmount", () => {
    const { unmount } = render(<HeroSection />);
    expect(contextSpy).toHaveBeenCalledOnce();

    unmount();
    expect(revertSpy).toHaveBeenCalledOnce();
  });
});
