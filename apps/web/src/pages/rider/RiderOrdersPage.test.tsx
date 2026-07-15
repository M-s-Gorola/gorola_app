/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, waitForElementToBeRemoved, within, type RenderResult } from "@testing-library/react";
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

    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "rider-123",
              riderType: "DELIVERY"
            }
          }
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: []
        }
      });
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
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Shift Orders");
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
            buyerName: "John Buyer",
            riderId: null,
            deliveryAddress: { landmark: "Near park" },
            items: [{ productName: "Apple", variantLabel: "1kg", quantity: 2 }],
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          },
          {
            id: "order-2",
            status: "OUT_FOR_DELIVERY",
            buyerMaskedPhone: "*********9876",
            buyerName: "Jane Buyer",
            riderId: "rider-123",
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
    expect(screen.queryByRole("button", { name: /Accept Order/i })).not.toBeInTheDocument();

    // Click the compact card to open the detail modal
    fireEvent.click(screen.getByText("Near park"));

    // Verify detail modal is rendered and shows full details
    expect(await screen.findByTestId("rider-order-modal")).toBeInTheDocument();
    expect(screen.getByText("*********3210")).toBeInTheDocument();
    expect(screen.getByText("John Buyer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept Order/i })).toBeInTheDocument();

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

  it("handles accept order transitions via modal actions and confirmation dialogs", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "order-1",
            status: "PREPARING",
            buyerMaskedPhone: "*********3210",
            buyerName: "John Buyer",
            riderId: null,
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
        data: { id: "order-1", status: "PREPARING", riderId: "rider-123" }
      }
    });

    renderRiderOrders();

    // Open detail modal
    fireEvent.click(await screen.findByText("Near park"));

    // Verify "Accept Order" button exists inside the modal
    const acceptButton = await screen.findByRole("button", { name: /Accept Order/i });
    expect(acceptButton).toBeInTheDocument();

    // Click it to open confirmation dialog
    fireEvent.click(acceptButton);

    // Verify confirmation dialog is shown
    expect(screen.getByText(/Are you sure you want to accept this order/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    // Wait for the modal to close / update
    await waitForElementToBeRemoved(() => screen.queryByText(/Confirm Status Update/i));

    // Check api.put is called
    expect(putMock).toHaveBeenCalledWith("/api/v1/rider/orders/order-1/accept");

    // Verify detailed modal remains open and accept button is disabled
    const modal = screen.getByTestId("rider-order-modal");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: /Accepted/i })).toBeDisabled();
  });

  it("handles deliver order status transitions successfully", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "order-2",
            status: "OUT_FOR_DELIVERY",
            buyerMaskedPhone: "*********9876",
            buyerName: "Jane Buyer",
            riderId: "rider-123",
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
        data: { id: "order-2", status: "DELIVERED" }
      }
    });

    renderRiderOrders();

    // Switch to out for delivery tab
    fireEvent.click(await screen.findByRole("button", { name: /Out for Delivery/i }));

    // Open detail modal
    fireEvent.click(await screen.findByText("Opposite mall"));

    // Verify "Mark as Delivered" button exists inside the modal
    const deliverButton = await screen.findByRole("button", { name: /Mark as Delivered/i });
    expect(deliverButton).toBeInTheDocument();

    // Click it to open confirmation dialog
    fireEvent.click(deliverButton);

    // Verify confirmation dialog is shown
    expect(screen.getByText(/Are you sure you want to mark this/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Delivered/i).length).toBeGreaterThanOrEqual(1);

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    // Wait for the confirmation to clear
    await waitForElementToBeRemoved(() => screen.queryByText(/Confirm Status Update/i));

    // Check api.put is called
    expect(putMock).toHaveBeenCalledWith("/api/v1/rider/orders/order-2/status", {
      status: "DELIVERED"
    });
  });

  it("renders map toggle button and displays OrderRouteMap when expanded inside detailed modal", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "order-1",
            status: "OUT_FOR_DELIVERY",
            buyerMaskedPhone: "*********3210",
            deliveryAddress: { landmark: "Near park", lat: 30.45, lng: 78.07 },
            items: [{ productName: "Apple", variantLabel: "1kg", quantity: 2 }],
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          }
        ]
      }
    });

    renderRiderOrders();

    // Switch to Out for Delivery tab
    fireEvent.click(await screen.findByRole("button", { name: /Out for Delivery/i }));

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

  it("renders booking orders and handles status transitions for field technician mode", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "rider-123",
              riderType: "FIELD_TECHNICIAN"
            }
          }
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: [
            {
              id: "booking-1",
              status: "OUT_FOR_DELIVERY",
              orderType: "BOOKING",
              bookingOrder: {
                scheduledDate: "2026-06-12T00:00:00.000Z",
                timeslot: "09:00 - 11:00",
                requiresFasting: true
              },
              buyerMaskedPhone: "*********3210",
              riderId: "rider-123",
              deliveryAddress: { landmark: "Near park" },
              items: [{ productName: "Thyroid Panel", variantLabel: "Single test", quantity: 1 }],
              createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
            }
          ]
        }
      });
    });

    putMock.mockResolvedValue({
      data: {
        success: true,
        data: { id: "booking-1", status: "DELIVERED" }
      }
    });

    renderRiderOrders();

    // Verify dynamic field technician text labels
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Today's Bookings");
      expect(screen.getByText("Scheduled for today")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Ready for Visit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Departed/i })).toBeInTheDocument();

    // Toggle tab to Departed
    fireEvent.click(screen.getByRole("button", { name: /Departed/i }));

    // Verify filter tab is rendered and the compact card is visible
    expect(await screen.findByTestId("booking-order-card")).toBeInTheDocument();
    expect(screen.getByText(/09:00 - 11:00/)).toBeInTheDocument();
    expect(screen.getByText(/Patient must be fasting/)).toBeInTheDocument();

    // Open detail modal
    fireEvent.click(screen.getByTestId("booking-order-card"));

    // Verify detailed modal elements
    const modal = await screen.findByTestId("rider-order-modal");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/Patient must be fasting/)).toBeInTheDocument();
    
    const completeButton = within(modal).getByRole("button", { name: /Mark Visit Complete/i });
    expect(completeButton).toBeInTheDocument();

    // Click Depart to show confirmation
    fireEvent.click(completeButton);
    expect(screen.getByText(/Confirm Status Update/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to mark this/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Visit Complete/i).length).toBeGreaterThanOrEqual(1);

    // Confirm action
    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    await waitForElementToBeRemoved(() => screen.queryByText(/Confirm Status Update/i));

    // Verify API is called with status DELIVERED
    expect(putMock).toHaveBeenCalledWith("/api/v1/rider/orders/booking-1/status", {
      status: "DELIVERED"
    });
  });

  it("renders accepted order details modal without map, with full address, and accepted button text", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "order-1",
            status: "PREPARING",
            buyerMaskedPhone: "*********3210",
            buyerName: "John Buyer",
            riderId: "rider-123",
            storeName: "Hillside Mart",
            deliveryAddress: {
              landmark: "Near park",
              flatRoom: "Flat 101",
              deliveryNote: "Ring bell",
              lat: 30.123,
              lng: 78.123
            },
            items: [{ productName: "Apple", variantLabel: "1kg", quantity: 2 }],
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          }
        ]
      }
    });

    renderRiderOrders();

    // Click the compact card to open the detail modal
    fireEvent.click(await screen.findByText(/Near park/));

    const modal = await screen.findByTestId("rider-order-modal");
    expect(within(modal).getByText("Flat 101, Near park")).toBeInTheDocument();
    expect(within(modal).getByText("Note: Ring bell")).toBeInTheDocument();

    // Verify map is NOT rendered (Show Map button should be absent)
    expect(within(modal).queryByText(/Show Map/i)).not.toBeInTheDocument();

    // Verify disabled action button has store-specific accepted text
    const acceptedBtn = screen.getByRole("button", { name: /Accepted \(Go pick the order from the store: Hillside Mart\)/i });
    expect(acceptedBtn).toBeInTheDocument();
    expect(acceptedBtn).toBeDisabled();
  });
});
