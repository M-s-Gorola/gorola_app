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

  it("renders active orders with status filter tabs and compact cards that open detail modals", async () => {
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

    renderRiderOrders();

    // Verify filter tabs are rendered
    expect(await screen.findByRole("button", { name: /Ready for Pickup/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Out for Delivery/i })).toBeInTheDocument();

    // By default, "Ready for Pickup" tab is active. Verify order-1 is visible but order-2 is not
    expect(await screen.findByText("Apple (1kg) x2")).toBeInTheDocument();
    expect(screen.getByText("Near park")).toBeInTheDocument();
    expect(screen.queryByText("Banana (1 dozen) x1")).not.toBeInTheDocument();

    // Compact card should NOT show detailed fields or actions
    expect(screen.queryByText("*********3210")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark as Out for Delivery/i })).not.toBeInTheDocument();

    // Click the compact card to open the detail modal
    fireEvent.click(screen.getByText("Near park"));

    // Verify detail modal is rendered and shows full details
    expect(await screen.findByTestId("rider-order-modal")).toBeInTheDocument();
    expect(screen.getByText("*********3210")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark as Out for Delivery/i })).toBeInTheDocument();

    // Close the modal
    fireEvent.click(screen.getByLabelText("Close modal"));
    expect(screen.queryByTestId("rider-order-modal")).not.toBeInTheDocument();

    // Toggle filter tab to "Out for Delivery"
    fireEvent.click(screen.getByRole("button", { name: /Out for Delivery/i }));

    // Now order-2 (OUT_FOR_DELIVERY) is visible and order-1 is not
    expect(await screen.findByText("Banana (1 dozen) x1")).toBeInTheDocument();
    expect(screen.getByText("Opposite mall")).toBeInTheDocument();
    expect(screen.queryByText("Apple (1kg) x2")).not.toBeInTheDocument();
  });

  it("handles status transitions via modal actions and confirmation dialogs", async () => {
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

    // Open detail modal
    fireEvent.click(await screen.findByText("Near park"));

    // Verify "Mark as Out for Delivery" button exists inside the modal
    const pickupButton = await screen.findByRole("button", { name: /Mark as Out for Delivery/i });
    expect(pickupButton).toBeInTheDocument();

    // Click it to open confirmation dialog
    fireEvent.click(pickupButton);

    // Verify confirmation dialog is shown
    expect(screen.getByText(/Are you sure you want to mark this order/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    // Wait for the modal to close
    await waitForElementToBeRemoved(() => screen.queryByText(/Confirm Status Update/i));

    // Check api.put is called
    expect(putMock).toHaveBeenCalledWith("/api/v1/rider/orders/order-1/status", {
      status: "OUT_FOR_DELIVERY"
    });
  });

  it("renders map toggle button and displays OrderRouteMap when expanded inside detailed modal", async () => {
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

    // Open detail modal
    fireEvent.click(await screen.findByText("Near park"));

    // The map toggle button should be present in the modal
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
