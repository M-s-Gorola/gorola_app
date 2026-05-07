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
    act(() => {
      useAuthStore.setState({ isBootstrapPending: false });
    });
    render(<HeroSection />);
    expect(screen.getByText(/Good morning/i)).toBeInTheDocument();
    expect(screen.getByText(/Mussoorie/i)).toBeInTheDocument();
  });

  it("shows afternoon greeting for unauthenticated user", () => {
    vi.setSystemTime(new Date("2026-05-07T14:00:00"));
    act(() => {
      useAuthStore.setState({ isBootstrapPending: false });
    });
    render(<HeroSection />);
    expect(screen.getByText(/Good afternoon/i)).toBeInTheDocument();
    expect(screen.getByText(/Mussoorie/i)).toBeInTheDocument();
  });

  it("shows evening greeting for unauthenticated user", () => {
    vi.setSystemTime(new Date("2026-05-07T20:00:00"));
    act(() => {
      useAuthStore.setState({ isBootstrapPending: false });
    });
    render(<HeroSection />);
    expect(screen.getByText(/Good evening/i)).toBeInTheDocument();
    expect(screen.getByText(/Mussoorie/i)).toBeInTheDocument();
  });

  it("shows personalized greeting for authenticated user with name", () => {
    vi.setSystemTime(new Date("2026-05-07T08:00:00"));
    act(() => {
      useAuthStore.setState({ name: "Naveen", role: "BUYER", isBootstrapPending: false });
    });
    render(<HeroSection />);
    expect(screen.getByText(/Good morning/i)).toBeInTheDocument();
    expect(screen.getByText(/Naveen/i)).toBeInTheDocument();
  });

  it("renders normal mode subheadings and ETA copy from the random sets", () => {
    act(() => {
      useAuthStore.setState({ isBootstrapPending: false });
    });
    render(<HeroSection />);
    const normalHeadings = [
      "What do you need delivered today?",
      "What should arrive at your door today?",
      "Last-minute? We’ve got you."
    ];
    const heading = screen.getByRole("heading", { level: 1 }).textContent;
    expect(normalHeadings).toContain(heading);

    expect(screen.getByText("25-35 mins")).toBeInTheDocument();
    
    const normalETAs = [
      "These are hill roads!",
      "Hill roads. Scenic, not speedy.",
      "Good things take time in the mountains.",
      "Blame the mountains",
      "Our riders are basically mountain goats now.",
      "We brake for blind turns."
    ];
    const etaText = screen.getByText((content) => normalETAs.some(eta => content.includes(eta)));
    expect(etaText).toBeInTheDocument();
  });

  it("renders weather mode messages and modified ETA copy from the random sets", () => {
    act(() => {
      useWeatherStore.getState().setWeatherMode(true);
      useAuthStore.setState({ isBootstrapPending: false });
    });
    render(<HeroSection />);
    expect(screen.getByText(/Weather mode active/i)).toBeInTheDocument();
    
    const weatherHeadings = [
      "We’re out there so you can stay in.",
      "Roads are slow — we're still coming!",
      "The weather showed up. So did we."
    ];
    const heading = screen.getByRole("heading", { level: 1 }).textContent;
    expect(weatherHeadings).toContain(heading);

    expect(screen.getByText("45-55 mins")).toBeInTheDocument();
    
    const weatherETAs = [
      "We are delivering safely.",
      "We’re driving safe so you don’t have to.",
      "Our riders aren’t auditioning for action movies.",
      "Even the clouds are slowing traffic today"
    ];
    const etaText = screen.getByText((content) => weatherETAs.some(eta => content.includes(eta)));
    expect(etaText).toBeInTheDocument();

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
