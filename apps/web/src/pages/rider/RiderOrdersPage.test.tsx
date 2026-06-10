/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitForElementToBeRemoved, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RiderOrdersPage } from "./RiderOrdersPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: vi.fn(),
    put: putMock
  }
}));

let renderResult: RenderResult | undefined;

function renderRiderOrders(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false
      }
    }
  });
  renderResult = render(
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
    putMock.mockReset();
    useAuthStore.getState().setRiderSession({
      accessToken: "fake-access-token",
      refreshToken: "fake-refresh-token",
      userId: "rider-123",
      storeId: "store-456"
    });
  });

  afterEach(() => {
    renderResult?.unmount();
    document.body.innerHTML = "";
  });

  it("renders empty state when there are no active orders", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });

    renderRiderOrders();

    expect(await screen.findByText(/No active orders right now/i)).toBeInTheDocument();
  });

  it("renders active orders grouped by status (PREPARING and OUT_FOR_DELIVERY)", async () => {
    getMock.mockResolvedValue({
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
    expect(await screen.findByRole("heading", { name: /Ready for Pickup/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Out for Delivery/i })).toBeInTheDocument();

    // Verify order 1 details
    expect(screen.getByText("*********3210")).toBeInTheDocument();
    expect(screen.getByText("Near park")).toBeInTheDocument();
    expect(screen.getByText("Apple (1kg) x2")).toBeInTheDocument();

    // Verify order 2 details
    expect(screen.getByText("*********9876")).toBeInTheDocument();
    expect(screen.getByText("Opposite mall")).toBeInTheDocument();
    expect(screen.getByText("Banana (1 dozen) x1")).toBeInTheDocument();
  });

  it("renders status update action buttons and handles status transitions via confirmation modal", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "order-1",
            status: "PREPARING",
            buyerMaskedPhone: "*********3210",
            deliveryAddress: { landmark: "Near park" },
            items: [{ productName: "Apple", variantLabel: "1kg", quantity: 2 }],
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          },
          {
            id: "order-2",
            status: "OUT_FOR_DELIVERY",
            buyerMaskedPhone: "*********9876",
            deliveryAddress: { landmark: "Opposite mall" },
            items: [{ productName: "Banana", variantLabel: "1 dozen", quantity: 1 }],
            createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
          }
        ]
      }
    });

    putMock.mockResolvedValue({
      data: {
        success: true,
        data: { id: "order-1", status: "OUT_FOR_DELIVERY" }
      }
    });

    renderRiderOrders();

    // Verify "Mark as Out for Delivery" button exists for PREPARING order
    const pickupButton = await screen.findByRole("button", { name: /Mark as Out for Delivery/i });
    expect(pickupButton).toBeInTheDocument();

    // Verify "Mark as Delivered" button exists for OUT_FOR_DELIVERY order
    const deliveredButton = await screen.findByRole("button", { name: /Mark as Delivered/i });
    expect(deliveredButton).toBeInTheDocument();

    // Click "Mark as Out for Delivery" to open confirmation modal
    fireEvent.click(pickupButton);

    // Verify modal is shown
    expect(screen.getByText(/Are you sure you want to mark this order/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    // Wait for the modal to close to avoid leaking DOM state
    await waitForElementToBeRemoved(() => screen.queryByText(/Confirm Status Update/i));

    // Check api.put is called
    expect(putMock).toHaveBeenCalledWith("/api/v1/rider/orders/order-1/status", {
      status: "OUT_FOR_DELIVERY"
    });
  });

  it("renders map toggle button and displays OrderRouteMap when expanded", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "order-1",
            status: "PREPARING",
            buyerMaskedPhone: "*********3210",
            deliveryAddress: { landmark: "Near park", lat: 30.45, lng: 78.07 },
            items: [{ productName: "Apple", variantLabel: "1kg", quantity: 2 }],
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          }
        ]
      }
    });

    renderRiderOrders();

    // The map toggle button should be present
    const toggleButton = await screen.findByTestId("toggle-map-order-1");
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent(/Show Map/i);

    // Map should not be visible initially
    expect(screen.queryByLabelText(/order route map/i)).not.toBeInTheDocument();

    // Toggle expansion
    fireEvent.click(toggleButton);

    // Now the map region should be present
    expect(screen.getByRole("region", { name: /order route map/i })).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent(/Hide Map/i);
  });
});
