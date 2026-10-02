import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BuyerFooter } from "./BuyerFooter";

describe("BuyerFooter", () => {
  it("renders statutory legal links to Privacy Policy and Terms of Service", () => {
    render(
      <MemoryRouter>
        <BuyerFooter />
      </MemoryRouter>
    );

    const privacyLink = screen.getByRole("link", { name: /privacy/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute("href", "/privacy");

    const termsLink = screen.getByRole("link", { name: /terms/i });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute("href", "/terms");

    expect(screen.getByRole("link", { name: /about/i })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /support/i })).toHaveAttribute("href", "/support");
  });
});
