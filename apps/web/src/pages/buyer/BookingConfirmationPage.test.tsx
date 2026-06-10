import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
      discountAmount: undefined as string | undefined,
      discountCode: undefined as string | null | undefined,
      rating: null as boolean | null | undefined,
      ratingComment: null as string | null | undefined,
      deliveryLat: undefined as number | null | undefined,
      deliveryLng: undefined as number | null | undefined,
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

  it("renders success status text and completed details when status is COMPLETED", async () => {
    apiGetSpy.mockResolvedValue({
      data: mockBookingEnvelope("COMPLETED"),
    });

    renderComponent();

    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    expect(screen.getByText("Service Done")).toBeInTheDocument();
    expect(screen.getByText(/This booking appointment has been marked as completed/)).toBeInTheDocument();
  });

  it("renders technician departed details and route map when status is OUT_FOR_DELIVERY", async () => {
    const envelope = mockBookingEnvelope("OUT_FOR_DELIVERY");
    envelope.data = {
      ...envelope.data,
      deliveryLat: 30.45,
      deliveryLng: 78.06,
    };
    apiGetSpy.mockResolvedValue({
      data: envelope,
    });

    renderComponent();

    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    expect(screen.getByText("Technician On The Way")).toBeInTheDocument();
    expect(
      screen.getByText(/Your technician is on the way/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /order route map/i })).toBeInTheDocument();
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

  it("renders collapsible discount breakdown row when booking has discountAmount and discountCode", async () => {
    const envelope = mockBookingEnvelope("APPROVED");
    envelope.data = {
      ...envelope.data,
      discountAmount: "50.00",
      discountCode: "SAVE50",
    };

    apiGetSpy.mockResolvedValue({
      data: envelope,
    });

    renderComponent();

    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();

    // 1. Verify discount summary row renders
    const discountSummary = screen.getByTestId("discount-summary");
    expect(discountSummary).toBeInTheDocument();
    expect(discountSummary).toHaveTextContent("-Rs 50.00");

    // 2. Verify breakdown is not visible initially
    expect(screen.queryByTestId("discount-breakdown")).not.toBeInTheDocument();

    // 3. Toggle breakdown via chevron button
    const toggleChevron = screen.getByTestId("discount-toggle-chevron");
    fireEvent.click(toggleChevron);

    // 4. Verify breakdown is now visible with discount code and correct itemized discount amount
    const breakdown = screen.getByTestId("discount-breakdown");
    expect(breakdown).toBeInTheDocument();
    expect(within(breakdown).getByText("SAVE50")).toBeInTheDocument();
    expect(within(breakdown).getByText("-Rs 50.00")).toBeInTheDocument();

    // 5. Toggle breakdown again to hide
    fireEvent.click(toggleChevron);
    expect(screen.queryByTestId("discount-breakdown")).not.toBeInTheDocument();
  });

  it("does not render rating/feedback form when status is not COMPLETED or DELIVERED", async () => {
    apiGetSpy.mockResolvedValue({
      data: mockBookingEnvelope("PENDING_APPROVAL"),
    });

    renderComponent();
    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    expect(screen.queryByTestId("rate-service-section")).not.toBeInTheDocument();
  });

  it("renders empty rating/feedback form when status is COMPLETED and rating is null", async () => {
    const envelope = mockBookingEnvelope("COMPLETED");
    envelope.data = {
      ...envelope.data,
      rating: null,
      ratingComment: null,
    };
    apiGetSpy.mockResolvedValue({
      data: envelope,
    });

    renderComponent();
    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    
    expect(screen.getByTestId("rate-service-section")).toBeInTheDocument();
    expect(screen.getByText("Rate your service")).toBeInTheDocument();
    expect(screen.getByText("How was your overall experience?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thumbs Up/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thumbs Down/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Any feedback for the store/i)).not.toBeInTheDocument();
  });

  it("displays existing service rating submitted state if already rated", async () => {
    const envelope = mockBookingEnvelope("COMPLETED");
    envelope.data = {
      ...envelope.data,
      rating: false,
      ratingComment: "It was too late",
    };
    apiGetSpy.mockResolvedValue({
      data: envelope,
    });

    renderComponent();
    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    
    expect(screen.getByTestId("rate-service-section")).toBeInTheDocument();
    expect(screen.getByText("Rating submitted")).toBeInTheDocument();
    expect(screen.getByText(/"It was too late"/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thumbs Up/i })).not.toBeInTheDocument();
  });
});
