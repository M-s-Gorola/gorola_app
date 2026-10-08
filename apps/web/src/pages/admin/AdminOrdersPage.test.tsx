/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOrdersPage } from "./AdminOrdersPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string) => getMock(url)),
    post: vi.fn(),
    put: vi.fn((url: string, body: unknown) => putMock(url, body))
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

function renderAdminOrders(initialEntries: InitialEntry[] = ["/admin/orders"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminOrdersPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    useAuthStore.getState().setAdminSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-admin-id",
      twoFactorVerified: true
    });
  });

  it("renders loader/skeleton state initially", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderAdminOrders();

    expect(screen.getByTestId("orders-loading-skeleton")).toBeInTheDocument();
  });

  it("renders orders list, filters, and handles detail modal opening", async () => {
    const mockOrdersData = {
      success: true,
      data: {
        items: [
          {
            id: "order-12345678",
            buyerMaskedPhone: "******9001",
            storeName: "Dairy Plaza",
            itemsCount: 3,
            total: 250.0,
            status: "PLACED",
            createdAt: "2026-06-04T12:00:00.000Z",
            paymentMethod: "COD",
            riderName: "Rider Bob"
          }
        ],
        nextCursor: null,
        stores: [
          { id: "store-1", name: "Dairy Plaza" }
        ]
      }
    };

    getMock.mockResolvedValueOnce({ data: mockOrdersData });

    renderAdminOrders();

    expect(await screen.findByText("Platform Orders")).toBeInTheDocument();

    // Verify filters
    expect(screen.getByTestId("filter-store-select")).toBeInTheDocument();
    expect(screen.getByTestId("filter-status-select")).toBeInTheDocument();
    expect(screen.getByTestId("filter-payment-select")).toBeInTheDocument();

    // Verify row items
    expect(screen.getAllByText("Dairy Plaza")).toHaveLength(2);
    expect(screen.getByText("******9001")).toBeInTheDocument();
    expect(screen.getByText("Rider Bob")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("₹250.00")).toBeInTheDocument();
    expect(screen.getByText("PLACED")).toBeInTheDocument();

    // Mock detail route response when clicking row
    const mockDetailData = {
      success: true,
      data: {
        id: "order-12345678",
        status: "PLACED",
        subtotal: 240.0,
        deliveryFee: 10.0,
        total: 250.0,
        paymentMethod: "COD",
        landmarkDescription: "Near Mall",
        flatRoom: "Room 10",
        createdAt: "2026-06-04T12:00:00.000Z",
        buyerMaskedPhone: "******9001",
        store: { name: "Dairy Plaza", phone: "+91000" },
        items: [
          { id: "item-1", productName: "Milk", variantLabel: "1L", price: 80.0, quantity: 3 }
        ],
        statusHistory: [
          { id: "hist-1", status: "PLACED", changedBy: "BUYER", changedAt: "2026-06-04T12:00:00.000Z" }
        ],
        riderName: "Rider Bob"
      }
    };

    getMock.mockResolvedValueOnce({ data: mockDetailData });

    // Click "View Details"
    const viewBtn = screen.getByTestId("view-details-order-12345678");
    fireEvent.click(viewBtn);

    // Verify modal content
    const modal = await screen.findByTestId("order-details-modal");
    expect(modal).toBeInTheDocument();
    expect(await within(modal).findByText(/Room 10/)).toBeInTheDocument();
    expect(within(modal).getByText(/Near Mall/)).toBeInTheDocument();
    expect(within(modal).getByText("Milk")).toBeInTheDocument();
    expect(within(modal).getByText(/Rider Bob/)).toBeInTheDocument();
  });

  it("handles status force update validation and PUT trigger", async () => {
    const mockOrdersData = {
      success: true,
      data: {
        items: [
          {
            id: "order-12345678",
            buyerMaskedPhone: "******9001",
            storeName: "Dairy Plaza",
            itemsCount: 3,
            total: 250.0,
            status: "PLACED",
            createdAt: "2026-06-04T12:00:00.000Z",
            paymentMethod: "COD"
          }
        ],
        nextCursor: null,
        stores: [
          { id: "store-1", name: "Dairy Plaza" }
        ]
      }
    };

    getMock.mockResolvedValueOnce({ data: mockOrdersData });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminOrders();

    // Verify list loads
    expect(await screen.findAllByText("Dairy Plaza")).toHaveLength(2);

    // Click "Force Update"
    const forceBtn = screen.getByTestId("force-update-status-order-12345678");
    fireEvent.click(forceBtn);

    // Verify modal is visible
    expect(screen.getByText("Force Update Order Status")).toBeInTheDocument();

    // Confirm button should be disabled initially (empty audit note)
    const confirmBtn = screen.getByTestId("confirm-force-status-update");
    expect(confirmBtn).toBeDisabled();

    // Fill audit note
    const noteInput = screen.getByTestId("audit-note-input");
    fireEvent.change(noteInput, { target: { value: "Fraud cancelled" } });

    // Change status select option
    const statusSelect = screen.getByTestId("force-status-select");
    fireEvent.change(statusSelect, { target: { value: "CANCELLED" } });

    // Confirm button should be enabled now
    expect(confirmBtn).toBeEnabled();

    // Click confirm
    fireEvent.click(confirmBtn);

    // Verify PUT request
    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/orders/order-12345678/status", {
        status: "CANCELLED",
        auditNote: "Fraud cancelled"
      });
    });
  });

  it("renders 'Registered User' when buyer name is empty and renders resolved actors in timeline", async () => {
    const mockOrdersData = {
      success: true,
      data: {
        items: [
          {
            id: "order-9999",
            buyerMaskedPhone: "******9001",
            storeName: "Dairy Plaza",
            itemsCount: 1,
            total: 100.0,
            status: "DELIVERED",
            createdAt: "2026-06-04T12:00:00.000Z",
            paymentMethod: "COD"
          }
        ],
        nextCursor: null,
        stores: [{ id: "store-1", name: "Dairy Plaza" }]
      }
    };

    const mockDetailData = {
      success: true,
      data: {
        id: "order-9999",
        status: "DELIVERED",
        subtotal: 90.0,
        deliveryFee: 10.0,
        total: 100.0,
        paymentMethod: "COD",
        landmarkDescription: "Near Mall",
        flatRoom: "Flat 1",
        createdAt: "2026-06-04T12:00:00.000Z",
        buyerMaskedPhone: "******9001",
        user: { name: "", phone: "+919999999001" }, // Empty string
        store: { name: "Dairy Plaza", phone: "+91000" },
        items: [
          { id: "item-1", productName: "Butter", variantLabel: "500g", price: 90.0, quantity: 1 }
        ],
        statusHistory: [
          { id: "hist-1", status: "PLACED", changedBy: "Buyer (Registered User)", changedAt: "2026-06-04T12:00:00.000Z" },
          { id: "hist-2", status: "PREPARING", changedBy: "Store Owner (Dairy Plaza)", changedAt: "2026-06-04T12:05:00.000Z" }
        ],
        riderName: "Rider Bob"
      }
    };

    getMock.mockResolvedValueOnce({ data: mockOrdersData });
    getMock.mockResolvedValueOnce({ data: mockDetailData });

    renderAdminOrders();

    expect(await screen.findByTestId("view-details-order-9999")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-details-order-9999"));

    const modal = await screen.findByTestId("order-details-modal");
    expect(await within(modal).findByText("Registered User")).toBeInTheDocument();
    expect(within(modal).getByText(/By Buyer \(Registered User\)/)).toBeInTheDocument();
    expect(within(modal).getByText(/By Store Owner \(Dairy Plaza\)/)).toBeInTheDocument();
  });

  it("renders 'Service Fee' for BOOKING orders and 'Delivery Fee' for QUICK orders in detail modal", async () => {
    const mockOrdersData = {
      success: true,
      data: {
        items: [
          {
            id: "order-booking-admin",
            buyerMaskedPhone: "******9001",
            storeName: "GoRola Repairs",
            itemsCount: 1,
            total: 350.0,
            status: "PLACED",
            orderType: "BOOKING",
            createdAt: "2026-06-04T12:00:00.000Z",
            paymentMethod: "COD"
          }
        ],
        nextCursor: null,
        stores: [{ id: "store-repair", name: "GoRola Repairs" }]
      }
    };

    const mockDetailData = {
      success: true,
      data: {
        id: "order-booking-admin",
        status: "PLACED",
        orderType: "BOOKING",
        subtotal: 300.0,
        deliveryFee: 50.0,
        total: 350.0,
        paymentMethod: "COD",
        landmarkDescription: "Clock Tower",
        flatRoom: "Flat 101",
        createdAt: "2026-06-04T12:00:00.000Z",
        buyerMaskedPhone: "******9001",
        user: { name: "Alice", phone: "+919999999001" },
        store: { name: "GoRola Repairs", phone: "+91000" },
        items: [
          { id: "item-1", productName: "Plumbing Service", variantLabel: "Standard", price: 300.0, quantity: 1 }
        ],
        statusHistory: []
      }
    };

    getMock.mockResolvedValueOnce({ data: mockOrdersData });
    getMock.mockResolvedValueOnce({ data: mockDetailData });

    renderAdminOrders();

    expect(await screen.findByTestId("view-details-order-booking-admin")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-details-order-booking-admin"));

    const modal = await screen.findByTestId("order-details-modal");
    expect(modal).toBeInTheDocument();
    expect(await within(modal).findByText("Service Fee")).toBeInTheDocument();
    expect(within(modal).queryByText("Delivery Fee")).not.toBeInTheDocument();
  });

  it("renders promotional offer and discount breakdown lines in admin order details modal", async () => {
    const mockOrdersData = {
      success: true,
      data: {
        items: [
          {
            id: "order-promo-admin",
            buyerMaskedPhone: "******9001",
            storeName: "Dairy Plaza",
            itemsCount: 1,
            total: 200.0,
            status: "PLACED",
            orderType: "QUICK",
            createdAt: "2026-06-04T12:00:00.000Z",
            paymentMethod: "COD"
          }
        ],
        nextCursor: null,
        stores: [{ id: "store-1", name: "Dairy Plaza" }]
      }
    };

    const mockDetailData = {
      success: true,
      data: {
        id: "order-promo-admin",
        status: "PLACED",
        orderType: "QUICK",
        subtotal: 220.0,
        deliveryFee: 30.0,
        total: 200.0,
        discountSavingAmount: 20.0,
        offerSavingAmount: 30.0,
        appliedOfferTitle: "Mega Summer Deal",
        appliedDiscountCode: "PROMO20",
        paymentMethod: "COD",
        landmarkDescription: "Clock Tower",
        flatRoom: "Flat 101",
        createdAt: "2026-06-04T12:00:00.000Z",
        buyerMaskedPhone: "******9001",
        user: { name: "Alice", phone: "+919999999001" },
        store: { name: "Dairy Plaza", phone: "+91000" },
        items: [{ id: "item-1", productName: "Milk", variantLabel: "1L", price: 220.0, quantity: 1 }],
        statusHistory: []
      }
    };

    getMock.mockResolvedValueOnce({ data: mockOrdersData });
    getMock.mockResolvedValueOnce({ data: mockDetailData });

    renderAdminOrders();

    expect(await screen.findByTestId("view-details-order-promo-admin")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-details-order-promo-admin"));

    const modal = await screen.findByTestId("order-details-modal");
    expect(modal).toBeInTheDocument();

    expect(await within(modal).findByText(/Offer \(Mega Summer Deal\)/)).toBeInTheDocument();
    expect(within(modal).getByText(/Discount \(PROMO20\)/)).toBeInTheDocument();
  });
});


