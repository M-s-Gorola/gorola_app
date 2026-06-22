import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { BuyerLayout } from "@/components/buyer/BuyerLayout";
import { useCartStore } from "@/store/cart.store";

vi.mock("@/hooks/useSystemSettings", () => ({
  useSystemSettings: () => ({
    data: {
      DELIVERY_CHARGE: "30",
      SERVICE_CHARGE: "0"
    },
    isLoading: false
  })
}));

vi.mock("@/hooks/useSearchSuggestions", () => ({
  useSearchSuggestions: () => ({
    data: [],
    isLoading: false
  })
}));

describe("BuyerLayout", () => {
  it("renders nav, main content, and footer shell", () => {
    render(
      <MemoryRouter>
        <BuyerLayout>
          <h1>Buyer Home Content</h1>
        </BuyerLayout>
      </MemoryRouter>
    );
    // There are now multiple navigations (top and bottom)
    expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("Buyer Home Content")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("renders the bottom navigation tab bar with sm:hidden class", () => {
    render(
      <MemoryRouter>
        <BuyerLayout>
          <h1>Content</h1>
        </BuyerLayout>
      </MemoryRouter>
    );
    const bottomNav = screen.getByLabelText("Mobile navigation");
    expect(bottomNav).toBeInTheDocument();
    expect(bottomNav).toHaveClass("sm:hidden");
  });

  it("contains working bottom tabs for Home, Orders, and Profile", () => {
    render(
      <MemoryRouter>
        <BuyerLayout>
          <h1>Content</h1>
        </BuyerLayout>
      </MemoryRouter>
    );

    const bottomNav = screen.getByLabelText("Mobile navigation");

    const homeLink = within(bottomNav).getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");

    const ordersLink = within(bottomNav).getByRole("link", { name: /orders/i });
    expect(ordersLink).toHaveAttribute("href", "/account/orders");

    const profileLink = within(bottomNav).getByRole("link", { name: /profile/i });
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  it("triggers cart drawer open and shows badge count on Cart tab", async () => {
    const user = userEvent.setup();
    useCartStore.setState({
      lines: [{ productVariantId: "pv-1", quantity: 5, productName: "Apple", variantLabel: "1kg" }]
    });

    const openSpy = vi.spyOn(useCartStore.getState(), "open");

    render(
      <MemoryRouter>
        <BuyerLayout>
          <h1>Content</h1>
        </BuyerLayout>
      </MemoryRouter>
    );

    const bottomNav = screen.getByLabelText("Mobile navigation");

    // Verify badge count shows up on the mobile Cart tab
    const badge = within(bottomNav).getByTestId("mobile-cart-badge");
    expect(badge).toHaveTextContent("5");

    const cartBtn = within(bottomNav).getByRole("button", { name: /cart/i });

    await user.click(cartBtn);
    expect(openSpy).toHaveBeenCalled();
  });
});

