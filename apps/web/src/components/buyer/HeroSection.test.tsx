import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";
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
      fromTo: vi.fn().mockReturnThis(),
      to: vi.fn().mockReturnThis()
    }))
  }
}));

describe("HeroSection", () => {
  beforeEach(() => {
    revertSpy.mockClear();
    contextSpy.mockClear();
    vi.useFakeTimers();
    useAuthStore.getState().clearSession();
    useWeatherStore.getState().setWeatherMode(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render Gorola branding in the hero", () => {
    render(<HeroSection />);
    expect(screen.queryByText("GoRola")).not.toBeInTheDocument();
    // Assuming GorolaMountainMark might be identified by an aria-label or specific text
    expect(screen.queryByLabelText(/mountain logo/i)).not.toBeInTheDocument();
  });

  it("shows morning greeting for unauthenticated user", () => {
    vi.setSystemTime(new Date("2026-05-07T08:00:00"));
    render(<HeroSection />);
    expect(screen.getByText(/Good morning/i)).toBeInTheDocument();
    expect(screen.getByText(/Mussoorie/i)).toBeInTheDocument();
  });

  it("shows afternoon greeting for unauthenticated user", () => {
    vi.setSystemTime(new Date("2026-05-07T14:00:00"));
    render(<HeroSection />);
    expect(screen.getByText(/Good afternoon/i)).toBeInTheDocument();
    expect(screen.getByText(/Mussoorie/i)).toBeInTheDocument();
  });

  it("shows evening greeting for unauthenticated user", () => {
    vi.setSystemTime(new Date("2026-05-07T20:00:00"));
    render(<HeroSection />);
    expect(screen.getByText(/Good evening/i)).toBeInTheDocument();
    expect(screen.getByText(/Mussoorie/i)).toBeInTheDocument();
  });

  it("shows personalized greeting for authenticated user with name", () => {
    vi.setSystemTime(new Date("2026-05-07T08:00:00"));
    act(() => {
      useAuthStore.setState({ name: "Naveen", role: "BUYER" });
    });
    render(<HeroSection />);
    expect(screen.getByText(/Good morning/i)).toBeInTheDocument();
    expect(screen.getByText(/Naveen/i)).toBeInTheDocument();
  });

  it("renders normal mode subheadings and ETA copy", () => {
    render(<HeroSection />);
    expect(screen.getByText("What do you need delivered today?")).toBeInTheDocument();
    expect(screen.getByText("25-35 mins")).toBeInTheDocument();
    expect(screen.getByText(/These are hill roads!/i)).toBeInTheDocument();
  });

  it("renders weather mode messages and modified ETA copy", () => {
    act(() => {
      useWeatherStore.getState().setWeatherMode(true);
    });
    render(<HeroSection />);
    expect(screen.getByText(/Weather mode active/i)).toBeInTheDocument();
    expect(screen.getByText("Roads are foggy — we're still coming!")).toBeInTheDocument();
    expect(screen.getByText("45-55 mins")).toBeInTheDocument();
    expect(screen.getByText(/We are delivering safely./i)).toBeInTheDocument();
    // Greeting should NOT be visible in weather mode
    expect(screen.queryByText(/Good morning/i)).not.toBeInTheDocument();
  });

  it("reverts gsap context on unmount", () => {
    const { unmount } = render(<HeroSection />);
    expect(contextSpy).toHaveBeenCalledOnce();
    unmount();
    expect(revertSpy).toHaveBeenCalledOnce();
  });
});
