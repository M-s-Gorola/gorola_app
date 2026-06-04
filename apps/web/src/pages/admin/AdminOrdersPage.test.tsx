/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    renderAdminOrders();

    expect(await screen.findByText("Platform Orders")).toBeInTheDocument();

    // Verify filters
    expect(screen.getByTestId("filter-store-select")).toBeInTheDocument();
    expect(screen.getByTestId("filter-status-select")).toBeInTheDocument();
    expect(screen.getByTestId("filter-payment-select")).toBeInTheDocument();

    // Verify row items
    expect(screen.getAllByText("Dairy Plaza")).toHaveLength(2);
    expect(screen.getByText("******9001")).toBeInTheDocument();
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
        ]
      }
    };

    getMock.mockResolvedValueOnce({ data: mockDetailData });

    // Click "View Details"
    const viewBtn = screen.getByTestId("view-details-order-12345678");
    fireEvent.click(viewBtn);

    // Verify modal content
    expect(await screen.findByTestId("order-details-modal")).toBeInTheDocument();
    expect(await screen.findByText(/Room 10/)).toBeInTheDocument();
    expect(await screen.findByText(/Near Mall/)).toBeInTheDocument();
    expect(await screen.findByText("Milk")).toBeInTheDocument();
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
});
