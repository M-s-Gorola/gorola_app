import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BuyerLayout } from "@/components/buyer/BuyerLayout";

describe("BuyerLayout", () => {
  it("renders nav, main content, and footer shell", () => {
    render(
      <MemoryRouter>
        <BuyerLayout>
          <h1>Buyer Home Content</h1>
        </BuyerLayout>
      </MemoryRouter>
    );
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("Buyer Home Content")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
