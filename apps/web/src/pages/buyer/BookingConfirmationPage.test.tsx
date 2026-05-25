import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { MockInstance } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

import { BookingConfirmationPage } from "./BookingConfirmationPage";

vi.mock("gsap", () => ({
  default: {
    context: vi.fn((fn: () => void) => {
      fn();
      return { revert: vi.fn() };
    }),
    set: vi.fn(),
    timeline: vi.fn(() => ({
      to: vi.fn(function (this: unknown) {
        return this;
      }),
      set: vi.fn(function (this: unknown) {
        return this;
      }),
    })),
  },
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe("BookingConfirmationPage", () => {
  let apiGetSpy: MockInstance;

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ isBootstrapPending: false, accessToken: "token-buyer", role: "BUYER" });

    apiGetSpy = vi.spyOn(api!, "get");
  });

  const renderComponent = (orderId = "ord-booking-777") => {
    render(
      <MemoryRouter initialEntries={[`/bookings/${orderId}`]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route element={<BookingConfirmationPage />} path="/bookings/:id" />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  const mockBookingEnvelope = (status = "PENDING_APPROVAL", rejectionReason: string | null = null) => ({
    success: true,
    data: {
      id: "ord-booking-777",
      status,
      subtotal: "500.00",
      deliveryFee: "0.00",
      total: "500.00",
      paymentMethod: "COD",
      landmarkDescription: "Near Clock Tower Mussoorie",
      flatRoom: "101",
      createdAt: "2026-05-18T10:00:00.000Z",
      store: {
        id: "store1",
        name: "Max Labs Mussoorie",
        phone: "+919999997103",
      } as { id: string; name: string; phone: string; storeType?: string } | undefined,
      items: [
        {
          id: "li1",
          productName: "CBC Blood Test",
          variantLabel: "Standard",
          price: "500.00",
          quantity: 1,
        },
      ],
      bookingOrder: {
        scheduledDate: "2026-05-20T08:00:00.000Z",
        timeslot: "06:00-09:00",
        requiresFasting: true,
        rejectionReason,
      },
    },
  });

  it("renders pending copy and yellow status badge under PENDING_APPROVAL", async () => {
    apiGetSpy.mockResolvedValue({
      data: mockBookingEnvelope("PENDING_APPROVAL"),
    });

    renderComponent();

    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    expect(screen.getAllByText(/Max Labs Mussoorie/)[0]).toBeInTheDocument();

    // Check pending badge or text
    expect(
      screen.getByText("Booking request sent. Waiting for store confirmation."),
    ).toBeInTheDocument();

    // Check other booking specifics
    expect(screen.getByText("2026-05-20")).toBeInTheDocument();
    expect(screen.getByText("06:00-09:00")).toBeInTheDocument();
    expect(screen.getByText(/Fasting Required/)).toBeInTheDocument();
  });

  it("renders success status text and schedule date/time details when status is APPROVED", async () => {
    apiGetSpy.mockResolvedValue({
      data: mockBookingEnvelope("APPROVED"),
    });

    renderComponent();

    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    expect(screen.getByText("Your booking is confirmed!")).toBeInTheDocument();
  });

  it("renders rejection reason banner when status transitions to REJECTED", async () => {
    apiGetSpy.mockResolvedValue({
      data: mockBookingEnvelope("REJECTED", "No available doctors for that slot"),
    });

    renderComponent();

    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    expect(screen.getByText("Booking Rejected")).toBeInTheDocument();
    expect(
      screen.getByText("Rejection Reason: No available doctors for that slot"),
    ).toBeInTheDocument();
  });

  it("renders robustly and does not crash even if the store field is null or undefined", async () => {
    const envelope = mockBookingEnvelope("PENDING_APPROVAL");
    envelope.data = { ...envelope.data, store: undefined };

    apiGetSpy.mockResolvedValue({
      data: envelope,
    });

    renderComponent();

    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    expect(screen.queryByText(/Max Labs Mussoorie/)).not.toBeInTheDocument();
  });
});
