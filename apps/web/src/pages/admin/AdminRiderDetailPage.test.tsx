/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRiderDetailPage } from "./AdminRiderDetailPage";
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

const mockRiderData = {
  success: true,
  data: {
    id: "rider-express-123",
    name: "Hillside Rider",
    email: "rider@gorola.in",
    maskedPhone: "*********0015",
    riderType: "DELIVERY",
    isActive: true,
    primaryStoreId: "store-1",
    primaryStoreName: "Hillside Fresh",
    totalDeliveries: 42,
    totalEarnings: 1050.0,
    createdAt: "2026-05-01T10:00:00.000Z",
    stores: [
      {
        storeId: "store-1",
        isPrimary: true,
        storeName: "Hillside Fresh",
        storeType: "QUICK_COMMERCE"
      },
      {
        storeId: "store-2",
        isPrimary: false,
        storeName: "Mall Road Mart",
        storeType: "QUICK_COMMERCE"
      }
    ]
  }
};

const mockRiderOrdersData = {
  success: true,
  data: {
    items: [
      {
        id: "ord-901",
        storeId: "store-1",
        storeName: "Hillside Fresh",
        userName: "Alice Walker",
        userMaskedPhone: "*********3210",
        total: 350.0,
        subtotal: 320.0,
        deliveryFee: 30.0,
        status: "DELIVERED",
        orderType: "QUICK",
        paymentMethod: "COD",
        itemCount: 3,
        createdAt: "2026-06-02T14:00:00.000Z"
      }
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1
  }
};

function renderAdminRiderDetail(initialEntries: InitialEntry[] = ["/admin/riders/rider-express-123"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/riders/:id" element={<AdminRiderDetailPage />} />
          <Route path="/admin/riders" element={<div>Riders List Page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminRiderDetailPage", () => {
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

  it("renders rider profile overview, assigned stores, metrics and paginated deliveries table", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/api/v1/admin/riders/rider-express-123/orders")) {
        return Promise.resolve({ data: mockRiderOrdersData });
      }
      if (url.includes("/api/v1/admin/riders/rider-express-123")) {
        return Promise.resolve({ data: mockRiderData });
      }
      return Promise.reject(new Error("Unknown url " + url));
    });

    renderAdminRiderDetail();

    // Verify rider profile info
    expect(await screen.findByTestId("rider-display-name")).toHaveTextContent("Hillside Rider");
    expect(screen.getByTestId("rider-status-badge")).toHaveTextContent("Active");
    expect(screen.getByTestId("rider-type-badge")).toHaveTextContent("Delivery");
    expect(screen.getByTestId("rider-phone")).toHaveTextContent("*********0015");
    expect(screen.getByTestId("rider-email")).toHaveTextContent("rider@gorola.in");
    expect(screen.getByTestId("rider-total-deliveries")).toHaveTextContent("42");
    expect(screen.getByTestId("rider-total-earnings")).toHaveTextContent("₹1,050.00");

    // Verify assigned stores
    expect(screen.getAllByText("Hillside Fresh").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Mall Road Mart")).toBeInTheDocument();
    expect(screen.getByText("Primary Store")).toBeInTheDocument();

    // Verify Deliveries table
    expect(screen.getByTestId("rider-orders-table")).toBeInTheDocument();
    expect(screen.getByText("Alice Walker")).toBeInTheDocument();
    expect(screen.getByText("₹350.00")).toBeInTheDocument();
  });

  it("handles status toggle modal and PUT trigger", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/orders")) return Promise.resolve({ data: mockRiderOrdersData });
      return Promise.resolve({ data: mockRiderData });
    });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminRiderDetail();

    const toggleBtn = await screen.findByTestId("toggle-rider-status-button");
    expect(toggleBtn).toHaveTextContent("Suspend Rider");
    fireEvent.click(toggleBtn);

    // Confirmation dialog appears
    expect(screen.getByText("Suspend Rider Partner?")).toBeInTheDocument();
    const confirmBtn = screen.getByTestId("confirm-rider-status-change");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/riders/rider-express-123", {
        isActive: false
      });
    });
  });

  it("clicking order details button opens the order breakdown modal", async () => {
    const mockOrderDetailData = {
      success: true,
      data: {
        id: "ord-901",
        status: "DELIVERED",
        subtotal: 320.0,
        deliveryFee: 30.0,
        total: 350.0,
        paymentMethod: "COD",
        landmarkDescription: "Near Mall Road Clock",
        flatRoom: "Suite 101",
        createdAt: "2026-06-02T14:00:00.000Z",
        buyerMaskedPhone: "*********3210",
        store: { name: "Hillside Fresh", phone: "+919999999011" },
        items: [
          { id: "item-1", productName: "Farm Apples", variantLabel: "1kg", price: 320.0, quantity: 1 }
        ],
        statusHistory: [
          { id: "hist-1", status: "PLACED", changedBy: "Buyer (Alice Walker)", changedAt: "2026-06-02T14:00:00.000Z" },
          { id: "hist-2", status: "DELIVERED", changedBy: "Rider (Hillside Rider)", changedAt: "2026-06-02T14:30:00.000Z" }
        ],
        riderName: "Hillside Rider"
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/orders/ord-901") return Promise.resolve({ data: mockOrderDetailData });
      if (url.includes("/orders")) return Promise.resolve({ data: mockRiderOrdersData });
      return Promise.resolve({ data: mockRiderData });
    });

    renderAdminRiderDetail();

    const viewBtn = await screen.findByTestId("view-rider-order-ord-901");
    fireEvent.click(viewBtn);

    const modal = await screen.findByTestId("rider-order-details-modal");
    expect(await within(modal).findByText("Farm Apples")).toBeInTheDocument();
    expect(within(modal).getByText(/By Rider \(Hillside Rider\)/)).toBeInTheDocument();
    expect(within(modal).getByText("Delivery Fee")).toBeInTheDocument();
  });

  it("renders 'Service Fee' for BOOKING orders in rider order details modal", async () => {
    const mockOrderDetailData = {
      success: true,
      data: {
        id: "ord-901",
        status: "DELIVERED",
        orderType: "BOOKING",
        subtotal: 400.0,
        deliveryFee: 40.0,
        total: 440.0,
        paymentMethod: "COD",
        landmarkDescription: "Near Mall Road Clock",
        flatRoom: "Suite 101",
        createdAt: "2026-06-02T14:00:00.000Z",
        buyerMaskedPhone: "*********3210",
        store: { name: "GoRola Repairs", phone: "+919999999011" },
        items: [
          { id: "item-1", productName: "Device Repair", variantLabel: "Standard", price: 400.0, quantity: 1 }
        ],
        statusHistory: [],
        riderName: "Tech Bob"
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/orders/ord-901") return Promise.resolve({ data: mockOrderDetailData });
      if (url.includes("/orders")) return Promise.resolve({ data: mockRiderOrdersData });
      return Promise.resolve({ data: mockRiderData });
    });

    renderAdminRiderDetail();

    const viewBtn = await screen.findByTestId("view-rider-order-ord-901");
    fireEvent.click(viewBtn);

    const modal = await screen.findByTestId("rider-order-details-modal");
    expect(modal).toBeInTheDocument();
    expect(await within(modal).findByText("Service Fee")).toBeInTheDocument();
    expect(within(modal).queryByText("Delivery Fee")).not.toBeInTheDocument();
  });
});
