import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { MockInstance } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

import { BookingTimeslotPage } from "./BookingTimeslotPage";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe("BookingTimeslotPage", () => {
  let apiGetSpy: MockInstance;
  let apiPostSpy: MockInstance;

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ isBootstrapPending: false, accessToken: "token-buyer", role: "BUYER" });

    apiGetSpy = vi.spyOn(api!, "get");
    apiPostSpy = vi.spyOn(api!, "post");
  });

  const renderComponent = (searchParams = "?productId=prod1&variantId=var1&storeId=store1") => {
    render(
      <MemoryRouter initialEntries={[`/bookings/new${searchParams}`]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route element={<BookingTimeslotPage />} path="/bookings/new" />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  it("renders timeslots and disables those other than 06:00-09:00 if requiresFasting is true", async () => {
    apiGetSpy.mockImplementation((url: string) => {
      if (url.includes("/api/v1/products/")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "prod1",
              name: "CBC Blood Test",
              description: "Complete blood count diagnostic",
              store: { id: "store1", name: "Max Labs" },
              variants: [
                {
                  id: "var1",
                  label: "Standard Test",
                  price: "500.00",
                  requiresFasting: true,
                  allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00"],
                },
              ],
            },
          },
        });
      }
      if (url.includes("/api/v1/addresses")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              addresses: [
                {
                  id: "addr1",
                  label: "Home",
                  landmarkDescription: "Near the Clock Tower Mussoorie",
                  flatRoom: "3",
                  isDefault: true,
                },
              ],
            },
          },
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderComponent();

    // Verify product name and fasting warning banner renders
    expect(await screen.findByText("CBC Blood Test")).toBeInTheDocument();
    expect(
      screen.getByText("⚠️ This test requires fasting. Please schedule for early morning."),
    ).toBeInTheDocument();

    // Verify 06:00-09:00 timeslot pill is active/enabled, others are disabled
    const morningPill = screen.getByRole("button", { name: "06:00-09:00" });
    expect(morningPill).toBeInTheDocument();
    expect(morningPill).not.toBeDisabled();

    const otherPill = screen.getByRole("button", { name: "09:00-12:00" });
    expect(otherPill).toBeDisabled();
  });

  it("disables today and past dates if bookingLeadDays is 1", async () => {
    apiGetSpy.mockImplementation((url: string) => {
      if (url.includes("/api/v1/products/")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "prod1",
              name: "CBC Blood Test",
              store: { id: "store1", name: "Max Labs", bookingLeadDays: 1 },
              variants: [
                {
                  id: "var1",
                  label: "Standard Test",
                  price: "500.00",
                  requiresFasting: false,
                  allowedTimeslots: ["06:00-09:00", "09:00-12:00"],
                },
              ],
            },
          },
        });
      }
      if (url.includes("/api/v1/addresses")) {
        return Promise.resolve({
          data: { success: true, data: { addresses: [] } },
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderComponent();
    await screen.findByText("CBC Blood Test");

    const dateInput = screen.getByLabelText(/Select Date/i);
    expect(dateInput).toBeInTheDocument();

    // Enforce tomorrow's date as min
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDateStr = tomorrow.toISOString().split("T")[0];

    expect(dateInput).toHaveAttribute("min", minDateStr);
  });

  it("keeps Confirm Booking disabled until date, timeslot, and address are selected", async () => {
    apiGetSpy.mockImplementation((url: string) => {
      if (url.includes("/api/v1/products/")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "prod1",
              name: "CBC Blood Test",
              store: { id: "store1", name: "Max Labs", bookingLeadDays: 1 },
              variants: [
                {
                  id: "var1",
                  label: "Standard Test",
                  price: "500.00",
                  requiresFasting: false,
                  allowedTimeslots: ["09:00-12:00"],
                },
              ],
            },
          },
        });
      }
      if (url.includes("/api/v1/addresses")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              addresses: [
                {
                  id: "addr1",
                  label: "Home",
                  landmarkDescription: "Near Clock Tower Mussoorie",
                  flatRoom: "1A",
                },
              ],
            },
          },
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    apiPostSpy.mockResolvedValue({
      data: {
        success: true,
        data: { orderId: "ord-new-123" },
      },
    });

    renderComponent();
    await screen.findByText("CBC Blood Test");

    const confirmBtn = screen.getByRole("button", { name: /Confirm Booking/i });
    expect(confirmBtn).toBeDisabled();

    // Select date
    const dateInput = screen.getByLabelText(/Select Date/i);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    fireEvent.change(dateInput, { target: { value: tomorrowStr } });

    // Confirm still disabled (no timeslot and address chosen yet)
    expect(confirmBtn).toBeDisabled();

    // Select timeslot
    const slotBtn = screen.getByRole("button", { name: "09:00-12:00" });
    fireEvent.click(slotBtn);

    // Confirm still disabled (no address selected)
    expect(confirmBtn).toBeDisabled();

    // Select address
    const addressRadio = screen.getByLabelText(/Near Clock Tower Mussoorie/i);
    fireEvent.click(addressRadio);

    // Now all selected, button is enabled!
    expect(confirmBtn).not.toBeDisabled();

    // Click Confirm Booking
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith(
        "/api/v1/bookings",
        expect.objectContaining({
          storeId: "store1",
          items: [{ productId: "prod1", variantId: "var1", quantity: 1 }],
          timeslot: "09:00-12:00",
          addressId: "addr1",
        }),
      );
    });
  });
});
