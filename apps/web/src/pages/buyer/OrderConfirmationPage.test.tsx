/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderConfirmationPage } from "./OrderConfirmationPage";
import { useWeatherStore } from "@/store/weather.store";
import { useAuthStore } from "@/store/auth.store";






const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("gsap", () => ({
  default: {
    context: vi.fn((fn: () => void) => {
      fn();
      return { revert: vi.fn() };
    }),
    set: vi.fn(),
    timeline: vi.fn(() => {
      const chain = {
        add: vi.fn(function (this: typeof chain) {
          return this;
        }),
        eventCallback: vi.fn(function (this: typeof chain) {
          return this;
        }),
        fromTo: vi.fn(function (this: typeof chain) {
          return this;
        }),
        kill: vi.fn(),
        to: vi.fn(function (this: typeof chain) {
          return this;
        }),
      };
      return chain;
    }),
  },
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
  },
}));

const baseEnvelope = (): {
  data: Record<string, unknown>;
  success: boolean;
} => ({
  success: true,
  data: {
    id: "o-1",
    subtotal: "200.00",
    deliveryFee: "30.00",
    paymentMethod: "COD",
    status: "PLACED",
    total: "230.00",
    landmarkDescription: "Near Kulri Bazaar landmark area landmark text",
    items: [
      {
        id: "li-1",
        orderId: "o-1",
        price: "100.00",
        productName: "Organic Honey",
        productVariantId: "v1",
        quantity: 2,
        variantLabel: "350g jar",
      },
    ],
    store: {
      id: "store-99",
      name: "Kulri Provisions",
      phone: "+911200000099",
    },
    discount: {
      amount: "0.00",
      code: null,
    },
  },
});

function renderPage(initialPath = "/orders/o-1"): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route element={<OrderConfirmationPage />} path="/orders/:id" />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("OrderConfirmationPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    useWeatherStore.setState({ isWeatherMode: false });
    useAuthStore.setState({ isBootstrapPending: false, accessToken: "test-token", role: "BUYER" });
  });

  it("loads order detail, line items, store trust block with tel link, and totals including discount amount", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...baseEnvelope().data,
            discount: {
              amount: "10.00",
              code: "SAVE10",
            },
            total: "220.00",
          },
        },
      });
    });

    renderPage();

    await screen.findByRole("heading", { name: "Thank you" });
    expect(screen.getByRole("heading", { name: "Thank you" })).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Order items" });
    expect(within(list).getByText(/Organic Honey/)).toBeInTheDocument();
    const subtotalEl = screen.getByTestId("order-subtotal");
    expect(within(subtotalEl).getByText("Subtotal:")).toBeInTheDocument();
    expect(within(subtotalEl).getByText("Rs 200.00")).toBeInTheDocument();
    expect(screen.getByText("Delivery fee:")).toBeInTheDocument();
    expect(screen.getByText("Rs 30.00")).toBeInTheDocument();
    expect(screen.getByText("Discount:")).toBeInTheDocument();
    expect(screen.getByText("-Rs 10.00")).toBeInTheDocument();
    const totalEl = screen.getByTestId("order-total");
    expect(within(totalEl).getByText("Payment [Cash on delivery]:")).toBeInTheDocument();
    expect(within(totalEl).getByText("Rs 220.00")).toBeInTheDocument();

    expect(screen.getAllByText(/Kulri Provisions/).length).toBeGreaterThanOrEqual(1);

    const tel = screen.getByRole("link", { name: /Call Kulri Provisions/i });
    expect(tel).toHaveAttribute("href", "tel:+911200000099");

    expect(screen.getAllByText(/Placed/).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/Near Kulri Bazaar/)).toBeInTheDocument();
  });

  it("shows scheduling copy when scheduledFor is present", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...baseEnvelope().data,
            scheduledFor: "2026-05-07T17:30:00.000Z",
          },
        },
      });
    });

    renderPage();
    await screen.findByText(/Scheduled window:/i);
  });

  it("shows weather-route honest ETA copy when weather mode is toggled", async () => {
    useWeatherStore.setState({ isWeatherMode: true });
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: baseEnvelope(),
      });
    });

    renderPage();
    await screen.findByRole("heading", { name: "Thank you" });

    expect(screen.getAllByText(/Roads may be slower/).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/Weather-aware delivery/)).toBeInTheDocument();
  });

  it("renders correct heading for each status", async () => {
    const statuses = [
      { key: "PLACED", expected: "Thank you" },
      { key: "PREPARING", expected: "Store is picking items" },
      { key: "DELIVERED", expected: "Order Delivered" },
      { key: "CANCELLED", expected: "Order Cancelled" },
    ];

    for (const status of statuses) {
      getMock.mockImplementation((url: string) => {
        if (url.includes("/promotions/")) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              ...baseEnvelope().data,
              status: status.key,
            },
          },
        });
      });

      renderPage(`/orders/o-${status.key}`);
      
      const heading = await screen.findByRole("heading", { name: status.expected });
      expect(heading).toBeInTheDocument();
      expect(heading.id).toBe("occ-heading");
    }
  });

  it("renders a collapsible discount breakdown showing itemized promotions when toggled", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: "o-flat",
                title: "Flat Discount",
                discountType: "FLAT",
                discountValue: 10,
                minOrderAmount: null,
                maxDiscount: null,
                startsAt: "2026-05-01T00:00:00.000Z",
                endsAt: "2026-05-30T00:00:00.000Z",
                isActive: true
              }
            ]
          }
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...baseEnvelope().data,
            createdAt: "2026-05-15T12:00:00.000Z",
            discount: {
              amount: "10.00",
              code: "SAVE10",
            },
            total: "220.00",
          },
        },
      });
    });

    renderPage();

    await screen.findByRole("heading", { name: "Thank you" });

    // Assert summary row is shown
    expect(screen.getByTestId("discount-summary-row")).toBeInTheDocument();
    expect(screen.getByText("Discount:")).toBeInTheDocument();
    expect(screen.getByText("-Rs 10.00")).toBeInTheDocument();

    const toggle = screen.getByTestId("discount-breakdown-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    // Breakdown is hidden by default
    expect(screen.queryByTestId("discount-breakdown-list")).not.toBeInTheDocument();

    // Toggle expansion
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    
    const breakdownList = screen.getByTestId("discount-breakdown-list");
    expect(breakdownList).toBeInTheDocument();
    expect(within(breakdownList).getByText(/• Discount \(Flat Discount\)/)).toBeInTheDocument();
    expect(within(breakdownList).getByText("-Rs 10.00")).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("discount-breakdown-list")).not.toBeInTheDocument();
  });

  it("does not render rating/feedback form when status is not DELIVERED", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...baseEnvelope().data,
            status: "PLACED",
            rating: null,
            ratingComment: null,
          },
        },
      });
    });

    renderPage();
    await screen.findByRole("heading", { name: "Thank you" });
    expect(screen.queryByTestId("rate-order-section")).not.toBeInTheDocument();
  });

  it("renders empty rating/feedback form when status is DELIVERED and rating is null", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...baseEnvelope().data,
            status: "DELIVERED",
            rating: null,
            ratingComment: null,
          },
        },
      });
    });

    renderPage();
    await screen.findByRole("heading", { name: "Order Delivered" });
    
    expect(screen.getByTestId("rate-order-section")).toBeInTheDocument();
    expect(screen.getByText("Rate your order")).toBeInTheDocument();
    expect(screen.getByText("How was your overall experience?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rate 4.5 stars/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rate 5.0 stars/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Any feedback for the store/i)).not.toBeInTheDocument();
  });

  it("displays existing rating submitted state if already rated", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...baseEnvelope().data,
            status: "DELIVERED",
            rating: 4.5,
            ratingComment: "Super awesome service!",
          },
        },
      });
    });

    renderPage();
    await screen.findByRole("heading", { name: "Order Delivered" });
    
    expect(screen.getByTestId("rate-order-section")).toBeInTheDocument();
    expect(screen.getByText("Rating submitted")).toBeInTheDocument();
    expect(screen.getByText(/4.5 \/ 5/i)).toBeInTheDocument();
    expect(screen.getByText(/"Super awesome service!"/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rate 5.0 stars/i })).not.toBeInTheDocument();
  });

  it("renders a payment confirmed badge when paymentStatus is CAPTURED and method is UPI", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...baseEnvelope().data,
            paymentMethod: "UPI",
            paymentStatus: "CAPTURED",
          },
        },
      });
    });

    renderPage();
    await screen.findByRole("heading", { name: "Thank you" });
    expect(screen.getByText("Payment confirmed via UPI")).toBeInTheDocument();
  });

  it("renders a pay on delivery badge when paymentStatus is PENDING and method is COD", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/promotions/")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...baseEnvelope().data,
            paymentMethod: "COD",
            paymentStatus: "PENDING",
          },
        },
      });
    });

    renderPage();
    await screen.findByRole("heading", { name: "Thank you" });
    expect(screen.getByText("Pay on delivery")).toBeInTheDocument();
  });
});

