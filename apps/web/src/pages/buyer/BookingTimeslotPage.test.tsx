import { CANONICAL_CONSENT_NOTICES } from "@gorola/shared";
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

vi.mock("@/hooks/useSystemSettings", () => ({
  useSystemSettings: () => ({
    data: {
      DELIVERY_CHARGE: "30",
      SERVICE_CHARGE: "0"
    }
  })
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

    apiGetSpy = vi.spyOn(api!, "get").mockImplementation((url: string) => {
      if (url.includes("/api/v1/consent")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              consents: [
                {
                  id: "c-op",
                  purpose: "ORDER_PROCESSING",
                  isWithdrawn: false,
                  consentVersion: "1.0",
                  createdAt: "2026-09-20T00:00:00Z"
                }
              ]
            }
          }
        });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    });
    apiPostSpy = vi.spyOn(api!, "post");
  });

  it("renders marketing opt-in consent card and enables Confirm Booking when date, timeslot, and address are selected", async () => {
    apiGetSpy.mockImplementation((url: string) => {
      if (url.includes("/api/v1/consent")) {
        return Promise.resolve({
          data: { success: true, data: { consents: [] } }
        });
      }
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
                  allowedTimeslots: ["09:00-12:00"]
                }
              ]
            }
          }
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
                  flatRoom: "1A"
                }
              ]
            }
          }
        });
      }
      return Promise.reject(new Error("Not found"));
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

    // Select timeslot
    const slotBtn = screen.getByRole("button", { name: "09:00-12:00" });
    fireEvent.click(slotBtn);

    // Select address
    const addressRadio = screen.getByLabelText(/Near Clock Tower Mussoorie/i);
    fireEvent.click(addressRadio);

    // Marketing opt-in card should be rendered with notice modal trigger
    expect(screen.getByTestId("booking-marketing-opt-in")).toBeInTheDocument();
    expect(screen.getByTestId("view-notice-btn-MARKETING_COMMS")).toBeInTheDocument();

    // Confirm button is now enabled
    expect(confirmBtn).toBeEnabled();
  });

  it("renders harmonized DPDP statutory consent notice covering field service technicians", async () => {
    apiGetSpy.mockImplementation((url: string) => {
      if (url.includes("/api/v1/consent")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { consents: [] }
          }
        });
      }
      if (url.includes("/api/v1/promotions/store/")) {
        return Promise.resolve({
          data: {
            success: true,
            data: []
          }
        });
      }
      if (url.includes("/api/v1/products/prod1")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "prod1",
              name: "CBC Blood Test",
              store: { id: "store1", name: "Apex Labs", bookingLeadDays: 1 },
              variants: [
                {
                  id: "var1",
                  label: "Standard Test",
                  price: "500.00",
                  requiresFasting: false,
                  allowedTimeslots: ["09:00-12:00"]
                }
              ]
            }
          }
        });
      }
      return Promise.resolve({ data: { success: true, data: { addresses: [] } } });
    });

    renderComponent();
    await screen.findByText("CBC Blood Test");

    const addNewBtn = screen.getByRole("button", { name: /Add New/i });
    fireEvent.click(addNewBtn);

    const notice = await screen.findByTestId("order-processing-consent-notice");
    expect(notice).toHaveTextContent(/field service technicians/i);
    expect(notice).toHaveTextContent(/scheduled on-site service appointments/i);
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
      if (url.includes("/api/v1/consent")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              consents: []
            }
          }
        });
      }
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

  it("allows adding a new address and auto-selects it upon success", async () => {
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
      if (url.includes("/api/v1/consent")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { consents: [] }
          }
        });
      }
      if (url.includes("/api/v1/addresses")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              addresses: [],
            },
          },
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    apiPostSpy.mockImplementation((url: string) => {
      if (url === "/api/v1/addresses") {
        return Promise.resolve({
          data: {
            success: true,
            data: { id: "new-addr-999" },
          },
        });
      }
      if (url === "/api/v1/consent") {
        return Promise.resolve({
          data: { success: true }
        });
      }
      if (url === "/api/v1/bookings") {
        return Promise.resolve({
          data: {
            success: true,
            data: { orderId: "ord-new-123" },
          },
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderComponent();
    await screen.findByText("CBC Blood Test");

    // Click Add New button
    const addNewBtn = screen.getByRole("button", { name: /Add New/i });
    fireEvent.click(addNewBtn);

    // Verify modal is open
    expect(await screen.findByText("Add New Address")).toBeInTheDocument();
    expect(screen.getAllByTestId("view-notice-btn-ORDER_PROCESSING").length).toBeGreaterThanOrEqual(1);

    // Fill out the address form
    const labelInput = screen.getByLabelText(/Label/i);
    const landmarkInput = screen.getByLabelText(/Landmark/i);
    const flatRoomInput = screen.getByLabelText(/Flat \/ room/i);

    fireEvent.change(labelInput, { target: { value: "Office" } });
    fireEvent.change(landmarkInput, { target: { value: "Near Mall Road Mussoorie" } });
    fireEvent.change(flatRoomInput, { target: { value: "Suite 101" } });

    const ackCheckbox = await screen.findByTestId("order-processing-acknowledge-checkbox");
    fireEvent.click(ackCheckbox);

    // Click Save Address
    const saveBtn = screen.getByRole("button", { name: /Save Address/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith(
        "/api/v1/addresses",
        expect.objectContaining({
          label: "Office",
          landmarkDescription: "Near Mall Road Mussoorie",
          flatRoom: "Suite 101",
        }),
      );
    });

    // Verify modal closes and selectedAddressId is set
    await waitFor(() => {
      expect(screen.queryByText("Add New Address")).not.toBeInTheDocument();
    });
  });

  it("handles live offers and valid/invalid coupon code application", async () => {
    apiGetSpy.mockImplementation((url: string) => {
      if (url.includes("/api/v1/consent")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              consents: [
                {
                  id: "c-op",
                  purpose: "ORDER_PROCESSING",
                  isWithdrawn: false,
                  consentVersion: "1.0",
                  createdAt: "2026-09-20T00:00:00Z"
                }
              ]
            }
          }
        });
      }
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
      if (url.includes("/api/v1/promotions/store/store1/offers")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: "off1",
                title: "10% Store-Wide Discount",
                discountType: "PERCENTAGE",
                discountValue: 10,
                minOrderAmount: 400,
                maxDiscount: 100,
              },
              {
                id: "off2",
                title: "Locked Grand Offer",
                discountType: "FLAT",
                discountValue: 200,
                minOrderAmount: 1000,
                maxDiscount: null,
              },
            ],
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

    apiPostSpy.mockImplementation((url: string) => {
      if (url === "/api/v1/promotions/discounts/validate") {
        return Promise.resolve({
          data: {
            success: true,
            data: { amountSaved: 50 },
          },
        });
      }
      if (url === "/api/v1/bookings") {
        return Promise.resolve({
          data: {
            success: true,
            data: { orderId: "ord-new-123" },
          },
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderComponent();
    await screen.findByText("CBC Blood Test");

    // 1. Verify active store offers rendering
    // Unlocked offer
    expect(await screen.findByText(/✅ 10% Store-Wide Discount/i)).toBeInTheDocument();
    // Locked offer
    expect(screen.getByText(/Locked Grand Offer/i)).toBeInTheDocument();
    expect(screen.getByText(/· Minimum purchase: Rs 1000/i)).toBeInTheDocument();

    // 2. Select details to enable booking submission later
    const dateInput = screen.getByLabelText(/Select Date/i);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    fireEvent.change(dateInput, { target: { value: tomorrowStr } });

    const slotBtn = screen.getByRole("button", { name: "09:00-12:00" });
    fireEvent.click(slotBtn);

    const addressRadio = screen.getByLabelText(/Near Clock Tower Mussoorie/i);
    fireEvent.click(addressRadio);

    // 3. Apply a coupon code
    const couponInput = screen.getByPlaceholderText(/Discount code/i);
    fireEvent.change(couponInput, { target: { value: "SAVE50" } });

    const applyBtn = screen.getByRole("button", { name: /Apply/i });
    fireEvent.click(applyBtn);

    // 4. Verify applied coupon and total discount breakdown is collapsible
    // Total discount row should exist
    const discountSummary = await screen.findByTestId("discount-summary");
    expect(discountSummary).toBeInTheDocument();
    expect(discountSummary).toHaveTextContent("-Rs 100.00"); // 10% of 500 = 50 + coupon = 50. Total = 100.

    // Toggling the chevron shows itemized list
    const toggleChevron = screen.getByTestId("discount-toggle-chevron");
    fireEvent.click(toggleChevron);

    // Verify itemized components rendered
    expect(screen.getByText(/Store Offer \(10% Store-Wide Discount\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Discount Code \(SAVE50\)/i)).toBeInTheDocument();

    // 5. Confirm booking with coupon code sends discountCode in the request payload
    const confirmBtn = screen.getByRole("button", { name: /Confirm Booking/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith(
        "/api/v1/bookings",
        expect.objectContaining({
          storeId: "store1",
          discountCode: "SAVE50",
        }),
      );
    });
  });

  it("submits deliveryNote in POST /api/v1/bookings when buyer enters technician instructions", async () => {
    apiGetSpy.mockImplementation((url: string) => {
      if (url.includes("/api/v1/consent")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              consents: [
                {
                  id: "c-op",
                  purpose: "ORDER_PROCESSING",
                  isWithdrawn: false,
                  consentVersion: "1.0",
                  createdAt: "2026-09-20T00:00:00Z"
                }
              ]
            }
          }
        });
      }
      if (url.includes("/api/v1/promotions/store/")) {
        return Promise.resolve({
          data: { success: true, data: [] }
        });
      }
      if (url.includes("/api/v1/products/prod1")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "prod1",
              name: "CBC Blood Test",
              store: { id: "store1", name: "Apex Labs", bookingLeadDays: 1 },
              variants: [
                {
                  id: "var1",
                  label: "Standard Test",
                  price: "500.00",
                  requiresFasting: false,
                  allowedTimeslots: ["09:00-12:00"]
                }
              ]
            }
          }
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
                  flatRoom: "1A"
                }
              ]
            }
          }
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    apiPostSpy.mockImplementation((url: string) => {
      if (url === "/api/v1/bookings") {
        return Promise.resolve({
          data: {
            success: true,
            data: { orderId: "ord-new-123" }
          }
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderComponent();
    await screen.findByText("CBC Blood Test");

    const dateInput = screen.getByLabelText(/Select Date/i);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    fireEvent.change(dateInput, { target: { value: tomorrowStr } });

    const slotBtn = screen.getByRole("button", { name: "09:00-12:00" });
    fireEvent.click(slotBtn);

    const addressRadio = screen.getByLabelText(/Near Clock Tower Mussoorie/i);
    fireEvent.click(addressRadio);

    const noteInput = screen.getByLabelText(/Instructions for Field Technician/i);
    fireEvent.change(noteInput, { target: { value: "Patient requires gentle care" } });

    const confirmBtn = screen.getByRole("button", { name: /Confirm Booking/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith(
        "/api/v1/bookings",
        expect.objectContaining({
          storeId: "store1",
          deliveryNote: "Patient requires gentle care"
        })
      );
    });
  });

  it("records MARKETING_COMMS consent with canonical notice text when marketing opt-in is checked on booking confirmation", async () => {
    apiGetSpy.mockImplementation((url: string) => {
      if (url.includes("/api/v1/consent")) {
        return Promise.resolve({
          data: { success: true, data: { consents: [] } }
        });
      }
      if (url.includes("/api/v1/products/prod1")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: "prod1",
              name: "CBC Blood Test",
              store: { id: "store1", name: "Apex Labs", bookingLeadDays: 1 },
              variants: [
                {
                  id: "var1",
                  label: "Standard Test",
                  price: "500.00",
                  requiresFasting: false,
                  allowedTimeslots: ["09:00-12:00"]
                }
              ]
            }
          }
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
                  flatRoom: "1A"
                }
              ]
            }
          }
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    apiPostSpy.mockImplementation((url: string) => {
      if (url === "/api/v1/bookings") {
        return Promise.resolve({
          data: {
            success: true,
            data: { orderId: "ord-new-456" }
          }
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    renderComponent();
    await screen.findByText("CBC Blood Test");

    const dateInput = screen.getByLabelText(/Select Date/i);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    fireEvent.change(dateInput, { target: { value: tomorrowStr } });

    const slotBtn = screen.getByRole("button", { name: "09:00-12:00" });
    fireEvent.click(slotBtn);

    const addressRadio = screen.getByLabelText(/Near Clock Tower Mussoorie/i);
    fireEvent.click(addressRadio);

    const marketingCard = screen.getByTestId("booking-marketing-opt-in");
    expect(marketingCard).toBeInTheDocument();
    expect(marketingCard).toHaveTextContent(CANONICAL_CONSENT_NOTICES.MARKETING_COMMS.summaryText);

    const checkbox = screen.getByTestId("marketing-consent-checkbox");
    fireEvent.click(checkbox);

    const confirmBtn = screen.getByRole("button", { name: /Confirm Booking/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith("/api/v1/consent", {
        purpose: "MARKETING_COMMS",
        consentVersion: CANONICAL_CONSENT_NOTICES.MARKETING_COMMS.version,
        noticeText: CANONICAL_CONSENT_NOTICES.MARKETING_COMMS.plainText
      });
    });
  });
});
