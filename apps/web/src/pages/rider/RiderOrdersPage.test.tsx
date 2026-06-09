/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RiderOrdersPage } from "./RiderOrdersPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: vi.fn()
  }
}));

function renderRiderOrders(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <RiderOrdersPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("RiderOrdersPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthStore.getState().setRiderSession({
      accessToken: "fake-access-token",
      refreshToken: "fake-refresh-token",
      userId: "rider-123",
      storeId: "store-456"
    });
  });

  it("renders empty state when there are no active orders", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: []
      }
    });

    renderRiderOrders();

    expect(await screen.findByText(/No active orders right now/i)).toBeInTheDocument();
  });

  it("renders active orders grouped by status (PREPARING and OUT_FOR_DELIVERY)", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: "order-1",
            status: "PREPARING",
            buyerMaskedPhone: "*********3210",
            deliveryAddress: { landmark: "Near park" },
            items: [{ productName: "Apple", variantLabel: "1kg", quantity: 2 }],
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min ago
          },
          {
            id: "order-2",
            status: "OUT_FOR_DELIVERY",
            buyerMaskedPhone: "*********9876",
            deliveryAddress: { landmark: "Opposite mall" },
            items: [{ productName: "Banana", variantLabel: "1 dozen", quantity: 1 }],
            createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 min ago
          }
        ]
      }
    });

    renderRiderOrders();

    // Verify status sections are rendered
    expect(await screen.findByText(/Ready for Pickup/i)).toBeInTheDocument();
    expect(await screen.findByText(/Out for Delivery/i)).toBeInTheDocument();

    // Verify order 1 details
    expect(screen.getByText("*********3210")).toBeInTheDocument();
    expect(screen.getByText("Near park")).toBeInTheDocument();
    expect(screen.getByText("Apple (1kg) x2")).toBeInTheDocument();

    // Verify order 2 details
    expect(screen.getByText("*********9876")).toBeInTheDocument();
    expect(screen.getByText("Opposite mall")).toBeInTheDocument();
    expect(screen.getByText("Banana (1 dozen) x1")).toBeInTheDocument();
  });
});
