import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreLayout } from "@/components/store/StoreLayout";
import { useAuthStore } from "@/store/auth.store";

import { StoreBookingsPage } from "./StoreBookingsPage";

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    put: putMock,
    post: vi.fn(),
    delete: vi.fn()
  }
}));

function renderWithProviders(ui: React.ReactElement): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false
      }
    }
  });

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreBookingsPage TDD", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getMock.mockReset();
    putMock.mockReset();

    useAuthStore.setState({
      accessToken: "at-token",
      refreshToken: "rt-token",
      role: "STORE_OWNER",
      twoFactorVerified: true,
      storeId: "store-123"
    });
  });

  it("Pending tab displays both Approve and Reject action buttons", async () => {
    const mockBookings = [
      {
        id: "booking-1",
        orderId: "order-1",
        status: "PENDING_APPROVAL",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        landmarkDescription: "Near Picture Palace",
        flatRoom: "Flat 101",
        addressLabel: "Home",
        items: [
          {
            id: "item-1",
            productName: "Blood Sugar (Fasting)",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-23T08:00:00.000Z",
          timeslot: "06:00-09:00",
          requiresFasting: true,
          approvalStatus: "PENDING_APPROVAL"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    expect(await screen.findByText("Blood Sugar (Fasting)")).toBeInTheDocument();
    expect(screen.getByText(/Fasting Required/i)).toBeInTheDocument();

    // Click on the booking card to open details modal
    const user = userEvent.setup();
    const card = screen.getByTestId("booking-card-booking-1");
    await user.click(card);

    expect(screen.getByText("+91 98765 ***55")).toBeInTheDocument(); // Masked phone: "+91 98765 ***55"
    expect(screen.getByText(/06:00-09:00/)).toBeInTheDocument();

    // Verify complete address rendering on the bookings card
    expect(screen.queryByText(/\[Home\]:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Flat 101, Near Picture Palace/)).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: /approve booking/i });
    const rejectBtn = screen.getByRole("button", { name: /reject booking/i });

    expect(approveBtn).toBeInTheDocument();
    expect(rejectBtn).toBeInTheDocument();

    // Trigger Approve Mutation
    putMock.mockResolvedValue({
      data: { success: true }
    });

    await user.click(approveBtn);
    const confirmBtn = await screen.findByRole("button", { name: /confirm/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/bookings/order-1/approve");
    });
  });

  it("Rejection modal's confirm button is disabled until a rejection reason is entered", async () => {
    const mockBookings = [
      {
        id: "booking-2",
        orderId: "order-2",
        status: "PENDING_APPROVAL",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-2",
            productName: "Urine Routine",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-23T08:00:00.000Z",
          timeslot: "06:00-09:00",
          requiresFasting: false,
          approvalStatus: "PENDING_APPROVAL"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    expect(await screen.findByText("Urine Routine")).toBeInTheDocument();

    const user = userEvent.setup();
    const card = screen.getByTestId("booking-card-booking-2");
    await user.click(card);

    const rejectBtn = screen.getByRole("button", { name: /reject booking/i });
    await user.click(rejectBtn);

    // Rejection modal should open
    const modalTitle = screen.getByText(/Reject Booking Request/i);
    expect(modalTitle).toBeInTheDocument();

    const confirmRejectBtn = screen.getByRole("button", { name: /Confirm Rejection/i });
    expect(confirmRejectBtn).toBeDisabled();

    // Type a reason
    const reasonInput = screen.getByPlaceholderText(/Enter reason/i);
    await user.type(reasonInput, "Not enough capacity");

    expect(confirmRejectBtn).not.toBeDisabled();

    putMock.mockResolvedValue({
      data: { success: true }
    });

    await user.click(confirmRejectBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/bookings/order-2/reject", {
        reason: "Not enough capacity"
      });
    });
  });

  it("Upcoming tab displays approved appointments sorted chronologically by scheduled date", async () => {
    const mockBookings = [
      {
        id: "booking-upcoming-2",
        orderId: "order-upcoming-2",
        status: "APPROVED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-upcoming-2",
            productName: "Thyroid (TSH)",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-24T09:00:00.000Z",
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        }
      },
      {
        id: "booking-upcoming-1",
        orderId: "order-upcoming-1",
        status: "APPROVED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-upcoming-1",
            productName: "CBC Panel",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-23T09:00:00.000Z",
          timeslot: "06:00-09:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    // Click on approved tab
    const user = userEvent.setup();
    const approvedTab = await screen.findByRole("tab", { name: /approved/i });
    await user.click(approvedTab);

    expect(await screen.findByText("CBC Panel")).toBeInTheDocument();
    expect(screen.getByText("Thyroid (TSH)")).toBeInTheDocument();

    // Verify ordering is chronological by finding them in order
    const listItems = screen.getAllByRole("heading", { level: 3 });
    const productNames = listItems.map((item) => item.textContent);
    expect(productNames[0]).toContain("CBC Panel");
    expect(productNames[1]).toContain("Thyroid (TSH)");
  });

  it("Approved tab renders 'Mark On The Way' and 'Cancel Booking' buttons for APPROVED bookings", async () => {
    const mockBookings = [
      {
        id: "booking-upcoming-dispatch",
        orderId: "order-upcoming-dispatch",
        status: "APPROVED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-upcoming-dispatch",
            productName: "Thyroid (TSH)",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-24T09:00:00.000Z",
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    const approvedTab = await screen.findByRole("tab", { name: /approved/i });
    await user.click(approvedTab);

    expect(await screen.findByText("Thyroid (TSH)")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-upcoming-dispatch");
    await user.click(card);

    const onTheWayBtn = screen.getByRole("button", { name: /mark on the way/i });
    const cancelBtn = screen.getByRole("button", { name: /cancel booking/i });
    expect(onTheWayBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    putMock.mockResolvedValue({
      data: { success: true }
    });

    await user.click(onTheWayBtn);
    const confirmBtn = await screen.findByRole("button", { name: /confirm/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/bookings/order-upcoming-dispatch/dispatch");
    });
  });

  it("Approved tab allows canceling an approved booking with a reason", async () => {
    const mockBookings = [
      {
        id: "booking-upcoming-cancel",
        orderId: "order-upcoming-cancel",
        status: "APPROVED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-upcoming-cancel",
            productName: "Thyroid (TSH)",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-24T09:00:00.000Z",
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    const approvedTab = await screen.findByRole("tab", { name: /approved/i });
    await user.click(approvedTab);

    const card = screen.getByTestId("booking-card-booking-upcoming-cancel");
    await user.click(card);

    const cancelBtn = screen.getByRole("button", { name: /cancel booking/i });
    await user.click(cancelBtn);

    // Cancel modal should open with dynamic title
    expect(screen.getByRole("heading", { name: "Cancel Booking" })).toBeInTheDocument();
    
    const reasonInput = screen.getByPlaceholderText(/Enter reason/i);
    await user.type(reasonInput, "Client changed mind");

    const confirmCancelBtn = screen.getByRole("button", { name: /Confirm Cancellation/i });
    
    putMock.mockResolvedValue({
      data: { success: true }
    });

    await user.click(confirmCancelBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/bookings/order-upcoming-cancel/reject", {
        reason: "Client changed mind"
      });
    });
  });

  it("On the Way tab renders 'Mark Completed' and 'Cancel Booking' buttons and completes OUT_FOR_DELIVERY bookings", async () => {
    const mockBookings = [
      {
        id: "booking-way-complete",
        orderId: "order-way-complete",
        status: "OUT_FOR_DELIVERY",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-way-complete",
            productName: "Thyroid (TSH)",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-24T09:00:00.000Z",
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    const activeTab = await screen.findByRole("tab", { name: /on the way/i });
    await user.click(activeTab);

    expect(await screen.findByText("Thyroid (TSH)")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-way-complete");
    await user.click(card);

    const completeBtn = screen.getByRole("button", { name: /mark completed/i });
    const cancelBtn = screen.getByRole("button", { name: /cancel booking/i });
    expect(completeBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    putMock.mockResolvedValue({
      data: { success: true }
    });

    await user.click(completeBtn);
    const confirmBtn = await screen.findByRole("button", { name: /confirm/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/bookings/order-way-complete/complete");
    });
  });

  it("History tab lists completed, rejected, and cancelled bookings", async () => {
    const mockBookings = [
      {
        id: "booking-hist-1",
        orderId: "order-hist-1",
        status: "REJECTED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-hist-1",
            productName: "Thyroid (TSH)",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-22T09:00:00.000Z",
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "REJECTED",
          rejectionReason: "Slot full"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    const historyTab = await screen.findByRole("tab", { name: /history/i });
    await user.click(historyTab);

    expect(await screen.findByText("Thyroid (TSH)")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-hist-1");
    await user.click(card);

    const modal = screen.getByTestId("booking-details-modal");
    // REJECTED booking must display "REJECTED" natively — NOT "CANCELLED"
    // Note: two REJECTED nodes appear (badge + status fallback), both are correct.
    expect(within(modal).getAllByText("REJECTED").length).toBeGreaterThan(0);
    expect(within(modal).getByText(/Reason: Slot full/)).toBeInTheDocument();
  });


  it("status transition log maps DELIVERED entries to COMPLETED display label", async () => {
    const mockBookings = [
      {
        id: "booking-delivered-test",
        orderId: "order-delivered-test",
        status: "COMPLETED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-delivered",
            productName: "Urine Microalbumin",
            variantLabel: "Standard",
            price: 400,
            quantity: 1
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-22T09:00:00.000Z",
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "COMPLETED"
        },
        subtotal: 400,
        deliveryFee: 0,
        discountAmount: 0,
        total: 400,
        statusHistory: [
          { id: "hist-d-1", status: "PENDING_APPROVAL", changedBy: "system", changedAt: "2026-05-21T22:00:00.000Z" },
          { id: "hist-d-2", status: "APPROVED", changedBy: "owner", changedAt: "2026-05-21T23:00:00.000Z" },
          // DELIVERED is the raw DB status — the UI must display it as COMPLETED
          { id: "hist-d-3", status: "DELIVERED", changedBy: "owner", changedAt: "2026-05-22T10:00:00.000Z" }
        ]
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    const historyTab = await screen.findByRole("tab", { name: /history/i });
    await user.click(historyTab);

    expect(await screen.findByText("Urine Microalbumin")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-delivered-test");
    await user.click(card);

    const historyList = screen.getByTestId("status-history-list");
    // The raw "DELIVERED" entry in the log must display as "COMPLETED" for booking commerce clarity
    expect(within(historyList).getByText("Completed")).toBeInTheDocument();
    // "DELIVERED" raw string must NOT appear
    expect(within(historyList).queryByText("Delivered")).not.toBeInTheDocument();
  });


  it("status transition log maps CANCELLED history entries to REJECTED when bookingOrder.approvalStatus is REJECTED", async () => {
    const mockBookings = [
      {
        id: "booking-reject-log-test",
        orderId: "order-reject-log-test",
        status: "REJECTED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-reject-log",
            productName: "Haemoglobin Test",
            variantLabel: "Standard",
            price: 200,
            quantity: 1
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-22T09:00:00.000Z",
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "REJECTED",
          rejectionReason: "No capacity"
        },
        subtotal: 200,
        deliveryFee: 0,
        discountAmount: 0,
        total: 200,
        statusHistory: [
          { id: "hist-r-1", status: "PENDING_APPROVAL", changedBy: "system", changedAt: "2026-05-21T22:00:00.000Z" },
          // Backend writes "CANCELLED" to orderStatusHistory during rejectBooking().
          // The UI must surface this as "REJECTED" when approvalStatus is REJECTED.
          { id: "hist-r-2", status: "CANCELLED", changedBy: "store-owner:owner-1", changedAt: "2026-05-21T23:00:00.000Z" }
        ]
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    const historyTab = await screen.findByRole("tab", { name: /history/i });
    await user.click(historyTab);

    expect(await screen.findByText("Haemoglobin Test")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-reject-log-test");
    await user.click(card);

    const historyList = screen.getByTestId("status-history-list");
    // The "CANCELLED" statusHistory entry must render as "REJECTED" when approvalStatus is REJECTED
    expect(within(historyList).getAllByText("Rejected").length).toBeGreaterThan(0);
    // The raw "CANCELLED" string must NOT appear in the log entries
    expect(within(historyList).queryByText("Cancelled")).not.toBeInTheDocument();
  });


  it("Navigation link Bookings in StoreLayout is hidden when storeType is QUICK_COMMERCE, shown when BOOKING_COMMERCE", async () => {
    // 1. Mock QUICK_COMMERCE store profile
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "store-123",
          name: "Mountain Medico",
          storeType: "QUICK_COMMERCE"
        }
      }
    });

    renderWithProviders(
      <StoreLayout>
        <div>Content</div>
      </StoreLayout>
    );

    // Wait for the profile to fetch
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/api/v1/store/profile");
    });

    // Bookings nav link should NOT be present in either sidebar or mobile menu
    expect(screen.queryAllByRole("link", { name: /bookings/i })).toHaveLength(0);

    // Reset layout for second render
    vi.restoreAllMocks();
    getMock.mockReset();

    // 2. Mock BOOKING_COMMERCE store profile
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "store-123",
          name: "Aarna Diagnostic Centre",
          storeType: "BOOKING_COMMERCE"
        }
      }
    });

    renderWithProviders(
      <StoreLayout>
        <div>Content</div>
      </StoreLayout>
    );

    // Wait for profile fetch and confirm nav link renders in sidebar and/or header
    await waitFor(() => {
      const links = screen.getAllByRole("link", { name: /bookings/i });
      expect(links.length).toBeGreaterThan(0);
    });
  });

  it("displays collapsible discount breakdown inside the detailed bookings modal", async () => {
    const mockBookings = [
      {
        id: "booking-discount-test",
        orderId: "order-discount-test",
        status: "PENDING_APPROVAL",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-discount",
            productName: "Full Body Checkup",
            variantLabel: "Premium",
            price: 1500,
            quantity: 1
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-23T08:00:00.000Z",
          timeslot: "06:00-09:00",
          requiresFasting: true,
          approvalStatus: "PENDING_APPROVAL"
        },
        subtotal: 1500,
        deliveryFee: 50,
        discountAmount: 200,
        discountCode: "WELCOME200",
        total: 1350,
        statusHistory: [
          { id: "hist-1", status: "PENDING_APPROVAL", changedBy: "system", changedAt: "2026-05-21T22:00:00.000Z" }
        ]
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    expect(await screen.findByText("Full Body Checkup")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-discount-test");
    await user.click(card);

    // Verify detailed modal details are displayed
    const modal = screen.getByTestId("booking-details-modal");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText("Buyer & Appointment")).toBeInTheDocument();
    expect(within(modal).getAllByText("Rs 1500.00")[0]).toBeInTheDocument();
    expect(within(modal).getByText("Rs 50.00")).toBeInTheDocument();
    expect(within(modal).getByText("Rs 1350.00")).toBeInTheDocument();

    // Verify discount is visible in its initial collapsed state
    const discountRow = screen.getByTestId("store-booking-discount");
    expect(discountRow).toBeInTheDocument();
    expect(within(discountRow).getByText("-Rs 200.00")).toBeInTheDocument();

    // Verify discount list detail is not rendered initially
    expect(screen.queryByTestId("store-booking-discount-list")).not.toBeInTheDocument();

    // Click toggle button to expand discount list details
    const toggleButton = screen.getByTestId("store-booking-discount-toggle");
    await user.click(toggleButton);

    // Verify discount list detail is now visible and contains promo info
    const discountList = screen.getByTestId("store-booking-discount-list");
    expect(discountList).toBeInTheDocument();
    expect(within(discountList).getByText(/• WELCOME200/)).toBeInTheDocument();
    expect(within(discountList).getByText("-Rs 200.00")).toBeInTheDocument();

    // Click toggle again to collapse
    await user.click(toggleButton);
    expect(screen.queryByTestId("store-booking-discount-list")).not.toBeInTheDocument();
  });

  it("renders status transition logs in the detailed modal", async () => {
    const mockBookings = [
      {
        id: "booking-timeline-test",
        orderId: "order-timeline-test",
        status: "APPROVED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-timeline",
            productName: "Blood Glucose Test",
            variantLabel: "Standard",
            price: 300,
            quantity: 1
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-23T08:00:00.000Z",
          timeslot: "06:00-09:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        },
        subtotal: 300,
        deliveryFee: 30,
        discountAmount: 0,
        discountCode: "",
        total: 330,
        statusHistory: [
          { id: "hist-1", status: "PENDING_APPROVAL", changedBy: "system", changedAt: "2026-05-21T22:00:00.000Z" },
          { id: "hist-2", status: "APPROVED", changedBy: "system", changedAt: "2026-05-21T23:00:00.000Z" }
        ]
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    const approvedTab = await screen.findByRole("tab", { name: /approved/i });
    await user.click(approvedTab);

    expect(await screen.findByText("Blood Glucose Test")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-timeline-test");
    await user.click(card);

    // Verify timeline logs are displayed
    expect(screen.getByText("Status Transition Log")).toBeInTheDocument();
    
  });


  it("Navigation link Bookings in StoreLayout is hidden when storeType is QUICK_COMMERCE, shown when BOOKING_COMMERCE", async () => {
    // 1. Mock QUICK_COMMERCE store profile
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "store-123",
          name: "Mountain Medico",
          storeType: "QUICK_COMMERCE"
        }
      }
    });

    renderWithProviders(
      <StoreLayout>
        <div>Content</div>
      </StoreLayout>
    );

    // Wait for the profile to fetch
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/api/v1/store/profile");
    });

    // Bookings nav link should NOT be present in either sidebar or mobile menu
    expect(screen.queryAllByRole("link", { name: /bookings/i })).toHaveLength(0);

    // Reset layout for second render
    vi.restoreAllMocks();
    getMock.mockReset();

    // 2. Mock BOOKING_COMMERCE store profile
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "store-123",
          name: "Aarna Diagnostic Centre",
          storeType: "BOOKING_COMMERCE"
        }
      }
    });

    renderWithProviders(
      <StoreLayout>
        <div>Content</div>
      </StoreLayout>
    );

    // Wait for profile fetch and confirm nav link renders in sidebar and/or header
    await waitFor(() => {
      const links = screen.getAllByRole("link", { name: /bookings/i });
      expect(links.length).toBeGreaterThan(0);
    });
  });

  it("displays collapsible discount breakdown inside the detailed bookings modal", async () => {
    const mockBookings = [
      {
        id: "booking-discount-test",
        orderId: "order-discount-test",
        status: "PENDING_APPROVAL",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-discount",
            productName: "Full Body Checkup",
            variantLabel: "Premium",
            price: 1500,
            quantity: 1
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-23T08:00:00.000Z",
          timeslot: "06:00-09:00",
          requiresFasting: true,
          approvalStatus: "PENDING_APPROVAL"
        },
        subtotal: 1500,
        deliveryFee: 50,
        discountAmount: 200,
        discountCode: "WELCOME200",
        total: 1350,
        statusHistory: [
          { id: "hist-1", status: "PENDING_APPROVAL", changedBy: "system", changedAt: "2026-05-21T22:00:00.000Z" }
        ]
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    expect(await screen.findByText("Full Body Checkup")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-discount-test");
    await user.click(card);

    // Verify detailed modal details are displayed
    const modal = screen.getByTestId("booking-details-modal");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText("Buyer & Appointment")).toBeInTheDocument();
    expect(within(modal).getAllByText("Rs 1500.00")[0]).toBeInTheDocument();
    expect(within(modal).getByText("Rs 50.00")).toBeInTheDocument();
    expect(within(modal).getByText("Rs 1350.00")).toBeInTheDocument();

    // Verify discount is visible in its initial collapsed state
    const discountRow = screen.getByTestId("store-booking-discount");
    expect(discountRow).toBeInTheDocument();
    expect(within(discountRow).getByText("-Rs 200.00")).toBeInTheDocument();

    // Verify discount list detail is not rendered initially
    expect(screen.queryByTestId("store-booking-discount-list")).not.toBeInTheDocument();

    // Click toggle button to expand discount list details
    const toggleButton = screen.getByTestId("store-booking-discount-toggle");
    await user.click(toggleButton);

    // Verify discount list detail is now visible and contains promo info
    const discountList = screen.getByTestId("store-booking-discount-list");
    expect(discountList).toBeInTheDocument();
    expect(within(discountList).getByText(/• WELCOME200/)).toBeInTheDocument();
    expect(within(discountList).getByText("-Rs 200.00")).toBeInTheDocument();

    // Click toggle again to collapse
    await user.click(toggleButton);
    expect(screen.queryByTestId("store-booking-discount-list")).not.toBeInTheDocument();
  });

  it("renders status transition logs in the detailed modal", async () => {
    const mockBookings = [
      {
        id: "booking-timeline-test",
        orderId: "order-timeline-test",
        status: "APPROVED",
        createdAt: "2026-05-21T22:00:00.000Z",
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-timeline",
            productName: "Blood Glucose Test",
            variantLabel: "Standard",
            price: 300,
            quantity: 1
          }
        ],
        bookingOrder: {
          scheduledDate: "2026-05-23T08:00:00.000Z",
          timeslot: "06:00-09:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        },
        subtotal: 300,
        deliveryFee: 30,
        discountAmount: 0,
        discountCode: "",
        total: 330,
        statusHistory: [
          { id: "hist-1", status: "PENDING_APPROVAL", changedBy: "system", changedAt: "2026-05-21T22:00:00.000Z" },
          { id: "hist-2", status: "APPROVED", changedBy: "system", changedAt: "2026-05-21T23:00:00.000Z" }
        ]
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    const user = userEvent.setup();
    const approvedTab = await screen.findByRole("tab", { name: /approved/i });
    await user.click(approvedTab);

    expect(await screen.findByText("Blood Glucose Test")).toBeInTheDocument();

    const card = screen.getByTestId("booking-card-booking-timeline-test");
    await user.click(card);

    // Verify timeline logs are displayed
    expect(screen.getByText("Status Transition Log")).toBeInTheDocument();
    
    const historyList = screen.getByTestId("status-history-list");
    expect(within(historyList).getByText("Pending Approval")).toBeInTheDocument();
    expect(within(historyList).getByText("Approved")).toBeInTheDocument();
  });

  it("renders five tabs: ALL, PENDING, APPROVED, ON_THE_WAY, and HISTORY", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });

    renderWithProviders(<StoreBookingsPage />);

    expect(await screen.findByRole("tab", { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /pending/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /approved/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /on the way/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
  });

  it("supports scheduled date filters including today, tomorrow, and custom ranges", async () => {
    const todayStr = new Date().toISOString();
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const mockBookings = [
      {
        id: "booking-today",
        orderId: "order-today",
        status: "APPROVED",
        createdAt: todayStr,
        customerPhone: "+919876543210",
        items: [{ id: "item-today", productName: "Today Test", variantLabel: "Standard" }],
        bookingOrder: {
          scheduledDate: todayStr,
          timeslot: "06:00-09:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        }
      },
      {
        id: "booking-tomorrow",
        orderId: "order-tomorrow",
        status: "APPROVED",
        createdAt: todayStr,
        customerPhone: "+919876543210",
        items: [{ id: "item-tomorrow", productName: "Tomorrow Test", variantLabel: "Standard" }],
        bookingOrder: {
          scheduledDate: tomorrowStr,
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    renderWithProviders(<StoreBookingsPage />);
    const user = userEvent.setup();

    // Verify filter dropdown is rendered with standard options
    const filterSelect = await screen.findByTestId("booking-date-filter");
    expect(filterSelect).toBeInTheDocument();
    expect(within(filterSelect).getByRole("option", { name: /All Dates/i })).toBeInTheDocument();
    expect(within(filterSelect).getByRole("option", { name: /Today/i })).toBeInTheDocument();
    expect(within(filterSelect).getByRole("option", { name: /Tomorrow/i })).toBeInTheDocument();
    expect(within(filterSelect).getByRole("option", { name: /This Week/i })).toBeInTheDocument();
    expect(within(filterSelect).getByRole("option", { name: /This Month/i })).toBeInTheDocument();
    expect(within(filterSelect).getByRole("option", { name: /Custom Range/i })).toBeInTheDocument();

    // By default (All Dates), both today and tomorrow bookings should be visible
    expect(await screen.findByText("Today Test")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow Test")).toBeInTheDocument();

    // Select Today filter
    await user.selectOptions(filterSelect, "TODAY");
    expect(screen.getByText("Today Test")).toBeInTheDocument();
    expect(screen.queryByText("Tomorrow Test")).not.toBeInTheDocument();

    // Select Tomorrow filter
    await user.selectOptions(filterSelect, "TOMORROW");
    expect(screen.queryByText("Today Test")).not.toBeInTheDocument();
    expect(screen.getByText("Tomorrow Test")).toBeInTheDocument();

    // Select Custom Range and check date inputs appear
    expect(screen.queryByTestId("date-from-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("date-to-input")).not.toBeInTheDocument();

    await user.selectOptions(filterSelect, "CUSTOM");
    const dateFrom = screen.getByTestId("date-from-input");
    const dateTo = screen.getByTestId("date-to-input");
    expect(dateFrom).toBeInTheDocument();
    expect(dateTo).toBeInTheDocument();

    // Set custom range that covers today only
    const todayYMD = new Date().toISOString().split("T")[0]!;
    await user.type(dateFrom, todayYMD);
    await user.type(dateTo, todayYMD);

    // Should only show today's test
    expect(screen.getByText("Today Test")).toBeInTheDocument();
    expect(screen.queryByText("Tomorrow Test")).not.toBeInTheDocument();
  });

  it("initializes activeTab and dateFilter state automatically from search parameters", async () => {
    const mockBookings = [
      {
        id: "booking-search-param-test",
        orderId: "order-search-param-test",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
        customerPhone: "+919876543210",
        items: [
          {
            id: "item-search-param",
            productName: "Search Param Test",
            variantLabel: "Standard"
          }
        ],
        bookingOrder: {
          scheduledDate: new Date().toISOString(),
          timeslot: "09:00-12:00",
          requiresFasting: false,
          approvalStatus: "APPROVED"
        }
      }
    ];

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: mockBookings
      }
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false
        }
      }
    });

    render(
      <MemoryRouter initialEntries={["/store/bookings?tab=APPROVED&dateFilter=TODAY"]}>
        <QueryClientProvider client={queryClient}>
          <StoreBookingsPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const approvedTab = await screen.findByRole("tab", { name: /approved/i });
    expect(approvedTab).toHaveAttribute("aria-selected", "true");

    const filterSelect = await screen.findByTestId("booking-date-filter");
    expect(filterSelect).toHaveValue("TODAY");

    expect(await screen.findByText("Search Param Test")).toBeInTheDocument();
  });
});
