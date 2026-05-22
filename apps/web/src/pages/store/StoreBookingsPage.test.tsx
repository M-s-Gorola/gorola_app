import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByText("+91 98765 ***55")).toBeInTheDocument(); // Masked phone: "+91 98765 ***55"
    expect(screen.getByText(/06:00-09:00/)).toBeInTheDocument();
    expect(screen.getByText(/Fasting Required/i)).toBeInTheDocument();

    // Verify complete address rendering on the bookings card
    expect(screen.queryByText(/\[Home\]:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Flat 101, Near Picture Palace/)).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: /approve/i });
    const rejectBtn = screen.getByRole("button", { name: /reject/i });

    expect(approveBtn).toBeInTheDocument();
    expect(rejectBtn).toBeInTheDocument();

    // Trigger Approve Mutation
    putMock.mockResolvedValue({
      data: { success: true }
    });

    const user = userEvent.setup();
    await user.click(approveBtn);

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

    const rejectBtn = screen.getByRole("button", { name: /reject/i });
    const user = userEvent.setup();
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

    // Click on Upcoming tab
    const user = userEvent.setup();
    const upcomingTab = await screen.findByRole("tab", { name: /upcoming/i });
    await user.click(upcomingTab);

    expect(await screen.findByText("CBC Panel")).toBeInTheDocument();
    expect(screen.getByText("Thyroid (TSH)")).toBeInTheDocument();

    // Verify ordering is chronological by finding them in order
    const listItems = screen.getAllByRole("heading", { level: 3 });
    const productNames = listItems.map((item) => item.textContent);

    expect(productNames[0]).toContain("CBC Panel");
    expect(productNames[1]).toContain("Thyroid (TSH)");
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
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
    expect(screen.getByText(/Reason: Slot full/)).toBeInTheDocument();
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
});
