import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";
import { AdminOrderDetailModal } from "./AdminOrderDetailModal";

const mockGet = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args)
  }
}));

const mockLenisStop = vi.fn();
const mockLenisStart = vi.fn();

vi.mock("@/lib/lenis", () => ({
  lenis: {
    stop: () => mockLenisStop(),
    start: () => mockLenisStart()
  }
}));

const socketListeners: Record<string, (...args: unknown[]) => void> = {};
const mockSocket = {
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    socketListeners[event] = cb;
  }),
  emit: vi.fn(),
  disconnect: vi.fn()
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket)
}));

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("AdminOrderDetailModal", () => {
  const mockOrderData = {
    id: "ord_1234567890",
    orderType: "REGULAR",
    status: "DELIVERED",
    createdAt: "2026-10-14T10:00:00.000Z",
    total: 1299.1,
    subtotal: 1499.0,
    deliveryFee: 50.0,
    discountAmount: 249.9,
    discounts: [
      { code: "FESTIVE50", amount: 150.0 },
      { offerTitle: "Store Flat 99 Off", amount: 99.9 }
    ],
    user: {
      name: "Rohan Verma",
      maskedPhone: "********7890"
    },
    store: {
      name: "Mussoorie Hill Mart",
      address: "The Mall Road, Mussoorie"
    },
    deliveryAddress: {
      flatRoom: "Flat 402",
      street: "Camel's Back Road",
      landmark: "Near Clock Tower",
      city: "Mussoorie"
    },
    deliveryNote: "Please ring the bell twice and leave at the doorstep.",
    items: [
      {
        id: "item_1",
        name: "Mountain Honey 500g",
        price: 749.5,
        quantity: 2,
        customizations: "Organic Wild"
      }
    ],
    statusHistory: [
      {
        id: "hist_1",
        status: "PLACED",
        changedAt: "2026-10-14T10:00:00.000Z",
        changedBy: "Buyer"
      },
      {
        id: "hist_2",
        status: "DELIVERED",
        changedAt: "2026-10-14T10:45:00.000Z",
        changedBy: "Rider"
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
    for (const key of Object.keys(socketListeners)) {
      delete socketListeners[key];
    }
    useAuthStore.setState({ accessToken: "fake-admin-token" });
  });

  it("renders nothing when orderId is null", () => {
    const { container } = renderWithClient(
      <AdminOrderDetailModal orderId={null} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("locks document.body scroll and stops lenis while open, and unlocks on unmount", async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });

    const { unmount } = renderWithClient(
      <AdminOrderDetailModal orderId="ord_1234567890" onClose={vi.fn()} />
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(mockLenisStop).toHaveBeenCalled();

    unmount();

    expect(document.body.style.overflow).toBe("");
    expect(mockLenisStart).toHaveBeenCalled();
  });

  it("has data-lenis-prevent and overscroll-contain on both overlay and modal card", async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });

    renderWithClient(
      <AdminOrderDetailModal orderId="ord_1234567890" onClose={vi.fn()} />
    );

    const overlay = await screen.findByTestId("order-details-modal");
    expect(overlay).toHaveAttribute("data-lenis-prevent");
    expect(overlay.className).toContain("overscroll-contain");

    const modalContent = overlay.firstElementChild as HTMLElement;
    expect(modalContent).toHaveAttribute("data-lenis-prevent");
    expect(modalContent.className).toContain("overscroll-contain");
  });

  it("renders order details, items, pricing, and delivery note callout banner with Store Panel structure", async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });

    renderWithClient(
      <AdminOrderDetailModal orderId="ord_1234567890" onClose={vi.fn()} />
    );

    expect(await screen.findByText(/#ORD_1234567890/i)).toBeInTheDocument();
    expect(screen.getAllByText("Delivered").length).toBeGreaterThan(0);
    expect(screen.getByText("Rohan Verma")).toBeInTheDocument();
    expect(screen.getByText("********7890")).toBeInTheDocument();
    expect(screen.getByText("Mussoorie Hill Mart")).toBeInTheDocument();

    // Check headings
    expect(screen.getByText("Buyer & Delivery Details")).toBeInTheDocument();
    expect(screen.getByText("Status Transition Log")).toBeInTheDocument();
    expect(screen.getByText("Itemized Summary")).toBeInTheDocument();

    // Delivery note callout
    const noteEl = screen.getByTestId("admin-delivery-note");
    expect(noteEl).toBeInTheDocument();
    expect(noteEl).toHaveTextContent("Please ring the bell twice and leave at the doorstep.");

    // Items
    expect(screen.getByText("Mountain Honey 500g")).toBeInTheDocument();
    expect(screen.getByText("Organic Wild")).toBeInTheDocument();

    // Financial breakdown
    expect(screen.getAllByText("Rs 1499.00").length).toBe(2);
    expect(screen.getByText("Rs 50.00")).toBeInTheDocument();
    expect(screen.getByText("Rs 1299.10")).toBeInTheDocument();
  });

  it("renders collapsible Total Discount dropdown and toggles breakdown", async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });

    renderWithClient(
      <AdminOrderDetailModal orderId="ord_1234567890" onClose={vi.fn()} />
    );

    const discountToggle = await screen.findByTestId("admin-toggle-discounts");
    expect(discountToggle).toBeInTheDocument();
    expect(screen.getByText("-Rs 249.90")).toBeInTheDocument();

    // Initially collapsed
    expect(screen.queryByText(/FESTIVE50/)).not.toBeInTheDocument();

    // Expand
    fireEvent.click(discountToggle);
    expect(screen.getByText(/FESTIVE50/)).toBeInTheDocument();
    expect(screen.getByText(/Store Flat 99 Off/)).toBeInTheDocument();

    // Collapse
    fireEvent.click(discountToggle);
    expect(screen.queryByText(/FESTIVE50/)).not.toBeInTheDocument();
  });

  it("renders booking appointment slot and service note when orderType is BOOKING", async () => {
    const bookingOrderData = {
      ...mockOrderData,
      id: "bk_998877",
      orderType: "BOOKING",
      deliveryNote: "Bring electrical multimeter",
      booking: {
        scheduledDate: "2026-10-20",
        timeslot: "10:00 AM - 12:00 PM"
      }
    };

    mockGet.mockResolvedValueOnce({ data: { success: true, data: bookingOrderData } });

    renderWithClient(
      <AdminOrderDetailModal orderId="bk_998877" onClose={vi.fn()} />
    );

    expect(await screen.findByText(/#BK_998877/i)).toBeInTheDocument();
    expect(screen.getByText("Buyer & Appointment")).toBeInTheDocument();
    expect(screen.getByText(/10:00 AM - 12:00 PM/)).toBeInTheDocument();

    const noteEl = screen.getByTestId("admin-delivery-note");
    expect(noteEl).toHaveTextContent("Bring electrical multimeter");
  });

  it("subscribes to socket room and updates status and status transition log in real time", async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });

    renderWithClient(
      <AdminOrderDetailModal orderId="ord_1234567890" onClose={vi.fn()} />
    );

    expect(await screen.findByText(/#ORD_1234567890/i)).toBeInTheDocument();

    // Verify connect & join_order emission
    const connectCb = socketListeners["connect"];
    expect(connectCb).toBeDefined();
    if (connectCb) connectCb();
    expect(mockSocket.emit).toHaveBeenCalledWith("join_order", "ord_1234567890");

    // Simulate real-time status update event over socket
    const orderStatusChangedCb = socketListeners["order_status_changed"];
    expect(orderStatusChangedCb).toBeDefined();

    act(() => {
      if (orderStatusChangedCb) {
        orderStatusChangedCb({
          orderId: "ord_1234567890",
          status: "APPROVED",
          statusHistory: [
            ...mockOrderData.statusHistory,
            {
              id: "hist_3",
              status: "APPROVED",
              changedAt: "2026-10-15T04:02:00.000Z",
              changedBy: "Store Owner",
              note: "Approved by store owner"
            }
          ]
        });
      }
    });

    // Check that Approved is rendered in status badge and transition log
    const approvedElements = await screen.findAllByText("Approved");
    expect(approvedElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Approved by store owner/i)).toBeInTheDocument();
  });

  it("invokes onClose when clicking close button or outside backdrop", async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });
    const onClose = vi.fn();

    renderWithClient(
      <AdminOrderDetailModal orderId="ord_1234567890" onClose={onClose} />
    );

    const closeButton = await screen.findByRole("button", { name: /close modal/i });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    const overlay = screen.getByTestId("order-details-modal");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  describe("Real-Time Updates & Booking Status Edge/Special Cases", () => {
    it("renders 'On The Way' in badge and timeline when booking status is OUT_FOR_DELIVERY", async () => {
      const bookingDispatchedData = {
        ...mockOrderData,
        id: "bk_dispatched_123",
        orderType: "BOOKING",
        status: "OUT_FOR_DELIVERY",
        statusHistory: [
          {
            id: "h1",
            status: "PLACED",
            changedAt: "2026-10-15T01:00:00.000Z",
            changedBy: "Buyer"
          },
          {
            id: "h2",
            status: "OUT_FOR_DELIVERY",
            changedAt: "2026-10-15T02:00:00.000Z",
            changedBy: "Store Owner (HealthCare Diagnostics)"
          }
        ],
        booking: {
          scheduledDate: "2026-10-15",
          timeslot: "09:00 AM - 11:00 AM"
        }
      };

      mockGet.mockResolvedValueOnce({ data: { success: true, data: bookingDispatchedData } });

      renderWithClient(
        <AdminOrderDetailModal orderId="bk_dispatched_123" onClose={vi.fn()} />
      );

      expect(await screen.findByText(/#BK_DISPATCHED_123/i)).toBeInTheDocument();

      // Must render "On The Way", not "Out For Delivery"
      const onTheWayElements = screen.getAllByText("On The Way");
      expect(onTheWayElements.length).toBeGreaterThanOrEqual(2); // Badge + Timeline
      expect(screen.queryByText(/Out For Delivery/i)).not.toBeInTheDocument();
    });

    it("updates status in real-time when receiving store:order_updated socket event", async () => {
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });

      renderWithClient(
        <AdminOrderDetailModal orderId="ord_1234567890" onClose={vi.fn()} />
      );

      expect(await screen.findByText(/#ORD_1234567890/i)).toBeInTheDocument();

      const storeOrderUpdatedCb = socketListeners["store:order_updated"];
      expect(storeOrderUpdatedCb).toBeDefined();

      act(() => {
        storeOrderUpdatedCb({
          orderId: "ord_1234567890",
          status: "OUT_FOR_DELIVERY",
          statusHistory: [
            ...mockOrderData.statusHistory,
            {
              id: "hist_live",
              status: "OUT_FOR_DELIVERY",
              changedAt: "2026-10-15T04:10:00.000Z",
              changedBy: "Rider (Rohan)",
              note: "Dispatched with rider"
            }
          ]
        });
      });

      const outForDeliveryElements = await screen.findAllByText("Out For Delivery");
      expect(outForDeliveryElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Dispatched with rider/i)).toBeInTheDocument();
    });

    it("handles case-insensitive order ID matching on socket event", async () => {
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });

      renderWithClient(
        <AdminOrderDetailModal orderId="ord_1234567890" onClose={vi.fn()} />
      );

      expect(await screen.findByText(/#ORD_1234567890/i)).toBeInTheDocument();

      const orderStatusChangedCb = socketListeners["order_status_changed"];
      expect(orderStatusChangedCb).toBeDefined();

      // Socket emits uppercase or mixed case order ID
      act(() => {
        orderStatusChangedCb({
          orderId: "ORD_1234567890",
          status: "CANCELLED",
          statusHistory: [
            ...mockOrderData.statusHistory,
            {
              id: "hist_cancel",
              status: "CANCELLED",
              changedAt: "2026-10-15T04:15:00.000Z",
              changedBy: "Admin",
              note: "Force cancelled"
            }
          ]
        });
      });

      const cancelledElements = await screen.findAllByText("Cancelled");
      expect(cancelledElements.length).toBeGreaterThanOrEqual(1);
    });

    it("ignores socket events intended for a different order ID", async () => {
      mockGet.mockResolvedValueOnce({ data: { success: true, data: mockOrderData } });

      renderWithClient(
        <AdminOrderDetailModal orderId="ord_1234567890" onClose={vi.fn()} />
      );

      expect(await screen.findByText(/#ORD_1234567890/i)).toBeInTheDocument();

      const orderStatusChangedCb = socketListeners["order_status_changed"];

      act(() => {
        orderStatusChangedCb({
          orderId: "ord_DIFFERENT_999",
          status: "CANCELLED"
        });
      });

      // Should still be Delivered, not Cancelled
      expect(screen.getAllByText("Delivered").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
    });

    it("extracts booking details from bookingOrder fallback when booking object is absent", async () => {
      const orderWithBookingOrderFallback = {
        ...mockOrderData,
        id: "bk_fallback_888",
        orderType: "BOOKING",
        deliveryNote: "Call when reaching gate",
        booking: null,
        bookingOrder: {
          id: "bo_888",
          scheduledDate: "2026-11-05T00:00:00.000Z",
          timeslot: "02:00 PM - 04:00 PM",
          requiresFasting: true,
          serviceInstructions: "Call when reaching gate"
        }
      };

      mockGet.mockResolvedValueOnce({ data: { success: true, data: orderWithBookingOrderFallback } });

      renderWithClient(
        <AdminOrderDetailModal orderId="bk_fallback_888" onClose={vi.fn()} />
      );

      expect(await screen.findByText(/#BK_FALLBACK_888/i)).toBeInTheDocument();
      expect(screen.getByText(/02:00 PM - 04:00 PM/)).toBeInTheDocument();
      expect(screen.getByText(/Call when reaching gate/i)).toBeInTheDocument();
      expect(screen.getByText(/Fasting Required/i)).toBeInTheDocument();
    });
  });
});
