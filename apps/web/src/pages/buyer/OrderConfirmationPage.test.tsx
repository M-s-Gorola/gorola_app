/* eslint-disable simple-import-sort/imports, import/order */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderConfirmationPage } from "./OrderConfirmationPage";
import { useWeatherStore } from "@/store/weather.store";






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
  });

  it("loads order detail, line items, store trust block with tel link, and totals including discount amount", async () => {
    getMock.mockResolvedValue({
      data: {
        ...baseEnvelope(),
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

    renderPage();

    await screen.findByRole("heading", { name: "Thank you" });
    expect(screen.getByRole("heading", { name: "Thank you" })).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Order items" });
    expect(within(list).getByText(/Organic Honey/)).toBeInTheDocument();
    expect(screen.getByText("Subtotal: Rs 200.00")).toBeInTheDocument();
    expect(screen.getByText("Delivery fee: Rs 30.00")).toBeInTheDocument();
    expect(screen.getByText("Discount: -Rs 10.00")).toBeInTheDocument();
    expect(screen.getByText("Total: Rs 220.00")).toBeInTheDocument();

    expect(screen.getAllByText(/Kulri Provisions/).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText((_c, el) => el?.tagName === "P" && el.textContent?.includes("Cash on delivery")),
    ).toBeInTheDocument();

    const tel = screen.getByRole("link", { name: /Call Kulri Provisions/i });
    expect(tel).toHaveAttribute("href", "tel:+911200000099");

    expect(screen.getAllByText(/received your order/).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/Near Kulri Bazaar/)).toBeInTheDocument();
  });

  it("shows scheduling copy when scheduledFor is present", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          ...baseEnvelope().data,
          scheduledFor: "2026-05-07T17:30:00.000Z",
        },
      },
    });

    renderPage();
    await screen.findByText(/Scheduled window:/i);
  });

  it("shows weather-route honest ETA copy when weather mode is toggled", async () => {
    useWeatherStore.setState({ isWeatherMode: true });
    getMock.mockResolvedValue({
      data: baseEnvelope(),
    });

    renderPage();
    await screen.findByRole("heading", { name: "Thank you" });

    expect(screen.getAllByText(/Roads may be slower/).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/Weather-aware delivery/)).toBeInTheDocument();
  });
});
