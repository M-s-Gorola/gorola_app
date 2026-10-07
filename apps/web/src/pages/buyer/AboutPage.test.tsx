import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AboutPage } from "./AboutPage";

describe("AboutPage (/about)", () => {
  it("renders Mussoorie-focused mission, story, pillars, and local merchant commitments", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // Main Heading & Mission
    expect(screen.getByRole("heading", { level: 1, name: /About GoRola/i })).toBeInTheDocument();
    expect(screen.getByText(/Mussoorie, delivered/i)).toBeInTheDocument();

    // Story & Hill Coverage
    expect(screen.getByText(/Mall Road to Landour/i)).toBeInTheDocument();
    expect(screen.getAllByText(/steep hill terrain/i).length).toBeGreaterThanOrEqual(1);

    // Core Pillars
    expect(screen.getByRole("heading", { name: /Hyperlocal Hill Logistics/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Weather-Adaptive Dispatch/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Empowering Local Merchants/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Privacy-First Architecture/i })).toBeInTheDocument();

    // Key Mussoorie neighborhoods
    expect(screen.getAllByText(/Kulri Bazaar/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Library Chowk/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Happy Valley/i).length).toBeGreaterThanOrEqual(1);

    // Navigation Links
    const exploreStoresLink = screen.getByRole("link", { name: /Explore Local Stores/i });
    expect(exploreStoresLink).toBeInTheDocument();
    expect(exploreStoresLink).toHaveAttribute("href", "/");

    const supportLink = screen.getByRole("link", { name: /Contact Support/i });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute("href", "/support");
  });
});
