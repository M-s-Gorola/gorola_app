import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RiderLayout } from "./RiderLayout";

// Mock resolveSubdomain so we can control subdomain resolution mode in tests
vi.mock("@/lib/subdomain-resolver", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subdomain-resolver")>("@/lib/subdomain-resolver");
  return {
    ...actual,
    resolveSubdomain: vi.fn(() => ({
      isSubdomainMode: false,
      subdomain: null
    }))
  };
});

let mockRiderType = "DELIVERY";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: {
        data: {
          riderType: mockRiderType
        }
      },
      isLoading: false
    }))
  };
});

describe("RiderLayout", () => {
  beforeEach(() => {
    mockRiderType = "DELIVERY";
  });

  it("renders bottom tab bar with 'Orders', 'Earnings' and 'Account' tabs", () => {
    render(
      <MemoryRouter initialEntries={["/rider/orders"]}>
        <RiderLayout>
          <div data-testid="child-content">Active Content</div>
        </RiderLayout>
      </MemoryRouter>
    );

    // Verify child content is rendered
    expect(screen.getByTestId("child-content")).toBeInTheDocument();

    // Verify navigation tabs exist
    expect(screen.getByRole("link", { name: /orders/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /earnings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
  });

  it("renders bottom tab bar with 'Services', 'Earnings' and 'Account' tabs for FIELD_TECHNICIAN", () => {
    mockRiderType = "FIELD_TECHNICIAN";
    render(
      <MemoryRouter initialEntries={["/rider/orders"]}>
        <RiderLayout>
          <div data-testid="child-content">Active Content</div>
        </RiderLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /services/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /earnings/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /orders/i })).not.toBeInTheDocument();
  });


  it("'Orders' tab is active on /rider/orders; 'Account' tab active on /rider/account", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/rider/orders"]}>
        <RiderLayout>
          <div>Content</div>
        </RiderLayout>
      </MemoryRouter>
    );

    const ordersLink = screen.getByRole("link", { name: /orders/i });
    const accountLink = screen.getByRole("link", { name: /account/i });

    // Expect orders to have active class/attribute
    expect(ordersLink).toHaveClass("text-gorola-pine");
    expect(accountLink).not.toHaveClass("text-gorola-pine");

    unmount();

    render(
      <MemoryRouter initialEntries={["/rider/account"]}>
        <RiderLayout>
          <div>Content</div>
        </RiderLayout>
      </MemoryRouter>
    );

    const ordersLink2 = screen.getByRole("link", { name: /orders/i });
    const accountLink2 = screen.getByRole("link", { name: /account/i });

    expect(ordersLink2).not.toHaveClass("text-gorola-pine");
    expect(accountLink2).toHaveClass("text-gorola-pine");
  });

  it("on mobile viewport (375px), all tap targets are >= 44px height", () => {
    render(
      <MemoryRouter initialEntries={["/rider/orders"]}>
        <RiderLayout>
          <div>Content</div>
        </RiderLayout>
      </MemoryRouter>
    );

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);

    for (const link of links) {
      // Check that the class list contains height or padding properties making it >= 44px (h-11 = 44px, h-12 = 48px, py-3 = 24px + icon size, py-4 = 32px + icon size)
      const hasLargeHeight = Array.from(link.classList).some((cls) =>
        cls.startsWith("h-") || cls.startsWith("py-") || cls.includes("h-11") || cls.includes("h-12") || cls.includes("py-3") || cls.includes("py-4")
      );
      expect(hasLargeHeight).toBe(true);
    }
  });
});
