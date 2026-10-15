/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminUserDetailPage } from "./AdminUserDetailPage";
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

const mockUserData = {
  success: true,
  data: {
    id: "user-alice-123",
    name: "Alice Walker",
    maskedPhone: "*********3210",
    isActive: true,
    createdAt: "2026-06-01T12:00:00.000Z",
    addresses: [
      { id: "addr-1", flatRoom: "Flat 402", landmarkDescription: "Near Picture Palace" }
    ],
    nomineeName: "Bob Walker"
  }
};

const mockUserOrdersData = {
  success: true,
  data: {
    items: [
      {
        id: "order-101",
        storeId: "store-1",
        storeName: "Hillside Store",
        total: 450.0,
        subtotal: 420.0,
        deliveryFee: 30.0,
        status: "DELIVERED",
        orderType: "QUICK",
        paymentMethod: "COD",
        itemsCount: 2,
        createdAt: "2026-06-02T14:00:00.000Z"
      }
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1
  }
};

const mockConsentsData = {
  success: true,
  data: {
    summary: [
      {
        purpose: "OTP_AUTH",
        displayName: "Authentication & Account Security",
        isEssential: true,
        isActive: true,
        givenAt: "2026-06-01T12:00:00.000Z",
        withdrawnAt: null,
        version: "v1.0"
      },
      {
        purpose: "ORDER_PROCESSING",
        displayName: "Order Fulfillment & Location Services",
        isEssential: true,
        isActive: true,
        givenAt: "2026-06-02T14:00:00.000Z",
        withdrawnAt: null,
        version: "v1.0"
      },
      {
        purpose: "MARKETING_COMMS",
        displayName: "Promotions & Seasonal Offers",
        isEssential: false,
        isActive: false,
        givenAt: null,
        withdrawnAt: null,
        version: null
      },
      {
        purpose: "ANALYTICS",
        displayName: "Usage & Performance Analytics",
        isEssential: false,
        isActive: false,
        givenAt: null,
        withdrawnAt: null,
        version: null
      },
      {
        purpose: "AGE_DECLARATION",
        displayName: "Age Confirmation",
        isEssential: true,
        isActive: true,
        givenAt: "2026-06-01T12:00:00.000Z",
        withdrawnAt: null,
        version: "v1.1"
      }
    ],
    logs: [
      {
        id: "log-1",
        purpose: "OTP_AUTH",
        isWithdrawn: false,
        consentVersion: "v1.0",
        noticeText: "Authentication notice",
        ipAddress: "127.0.0.1",
        createdAt: "2026-06-01T12:00:00.000Z"
      }
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1
  }
};

function renderAdminUserDetail(initialEntries: InitialEntry[] = ["/admin/users/user-alice-123"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin/users" element={<div>Users List Page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminUserDetailPage", () => {
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

  it("renders user overview, addresses, DPDP consent cards and paginated orders table", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/api/v1/admin/users/user-alice-123/orders")) {
        return Promise.resolve({ data: mockUserOrdersData });
      }
      if (url.includes("/api/v1/admin/users/user-alice-123/consents")) {
        return Promise.resolve({ data: mockConsentsData });
      }
      if (url.includes("/api/v1/admin/users/user-alice-123")) {
        return Promise.resolve({ data: mockUserData });
      }
      return Promise.reject(new Error("Unknown url " + url));
    });

    renderAdminUserDetail();

    // Verify user profile info
    expect(await screen.findByTestId("user-display-name")).toHaveTextContent("Alice Walker");
    expect(screen.getByTestId("user-status-badge")).toHaveTextContent("Active");
    expect(screen.getByTestId("user-phone")).toHaveTextContent("*********3210");
    expect(screen.getByTestId("user-nominee-info")).toHaveTextContent("Bob Walker");

    // Verify registered addresses
    expect(screen.getByText("Flat 402")).toBeInTheDocument();
    expect(screen.getByText("Near Picture Palace")).toBeInTheDocument();

    // Verify Orders section
    expect(screen.getByTestId("user-orders-table")).toBeInTheDocument();
    expect(screen.getByText("Hillside Store")).toBeInTheDocument();
    expect(screen.getByText("₹450.00")).toBeInTheDocument();
    expect(screen.getByText("QUICK")).toBeInTheDocument();

    // Verify DPDP Consent section
    expect(screen.getByTestId("user-consent-section")).toBeInTheDocument();
    expect(screen.getByText("Authentication & Account Security")).toBeInTheDocument();
    expect(screen.getByText("Order Fulfillment & Location Services")).toBeInTheDocument();
    expect(screen.getByText("Promotions & Seasonal Offers")).toBeInTheDocument();
    expect(screen.getByText("Age Confirmation")).toBeInTheDocument();
    const consentSummarySection = screen.getByTestId("consent-summary-section");
    const rows = within(consentSummarySection).getAllByRole("row");
    // 1 header row + 5 data rows = 6 rows
    expect(rows).toHaveLength(6);
  });

  it("renders 'Not Configured' when nomineeName is not set", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/orders")) return Promise.resolve({ data: mockUserOrdersData });
      if (url.includes("/consents")) return Promise.resolve({ data: mockConsentsData });
      return Promise.resolve({
        data: {
          success: true,
          data: {
            ...mockUserData.data,
            nomineeName: null
          }
        }
      });
    });

    renderAdminUserDetail();

    expect(await screen.findByTestId("user-display-name")).toHaveTextContent("Alice Walker");
    expect(screen.getByTestId("user-nominee-info")).toHaveTextContent("Not Configured");
  });

  it("handles status suspension modal and PUT trigger", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/orders")) return Promise.resolve({ data: mockUserOrdersData });
      if (url.includes("/consents")) return Promise.resolve({ data: mockConsentsData });
      return Promise.resolve({ data: mockUserData });
    });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminUserDetail();

    const suspendBtn = await screen.findByTestId("toggle-user-status-button");
    expect(suspendBtn).toHaveTextContent("Suspend User");
    fireEvent.click(suspendBtn);

    // Confirmation dialog appears
    expect(screen.getByText("Suspend User Account?")).toBeInTheDocument();
    const confirmBtn = screen.getByTestId("confirm-user-status-change");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/users/user-alice-123/suspend", {});
    });
  });

  it("clicking order details button opens the order breakdown modal", async () => {
    const mockOrderDetailData = {
      success: true,
      data: {
        id: "order-101",
        status: "DELIVERED",
        subtotal: 420.0,
        deliveryFee: 30.0,
        total: 450.0,
        paymentMethod: "COD",
        landmarkDescription: "Near Picture Palace",
        flatRoom: "Flat 402",
        createdAt: "2026-06-02T14:00:00.000Z",
        buyerMaskedPhone: "*********3210",
        store: { name: "Hillside Store", phone: "+919999999011" },
        items: [
          { id: "item-1", productName: "Basmati Rice", variantLabel: "5kg", price: 420.0, quantity: 1 }
        ],
        statusHistory: [
          { id: "hist-1", status: "PLACED", changedBy: "Buyer (Alice Walker)", changedAt: "2026-06-02T14:00:00.000Z" },
          { id: "hist-2", status: "DELIVERED", changedBy: "Rider (Hillside Rider)", changedAt: "2026-06-02T14:30:00.000Z" }
        ],
        riderName: "Hillside Rider"
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/orders/order-101") return Promise.resolve({ data: mockOrderDetailData });
      if (url.includes("/orders")) return Promise.resolve({ data: mockUserOrdersData });
      if (url.includes("/consents")) return Promise.resolve({ data: mockConsentsData });
      return Promise.resolve({ data: mockUserData });
    });

    renderAdminUserDetail();

    const viewBtn = await screen.findByTestId("view-user-order-order-101");
    fireEvent.click(viewBtn);

    const modal = await screen.findByTestId("user-order-details-modal");
    expect(await within(modal).findByText("Basmati Rice")).toBeInTheDocument();
    expect(within(modal).getByText(/By Buyer \(Alice Walker\)/)).toBeInTheDocument();
    expect(within(modal).getByText("Delivery Fee")).toBeInTheDocument();
  });

  it("renders 'Service Fee' for BOOKING orders in user order details modal", async () => {
    const mockOrderDetailData = {
      success: true,
      data: {
        id: "order-booking-user-1",
        status: "DELIVERED",
        orderType: "BOOKING",
        subtotal: 600.0,
        deliveryFee: 60.0,
        total: 660.0,
        paymentMethod: "COD",
        landmarkDescription: "Near Mall",
        flatRoom: "Flat 402",
        createdAt: "2026-06-02T14:00:00.000Z",
        buyerMaskedPhone: "*********3210",
        store: { name: "GoRola Repairs", phone: "+919999999011" },
        items: [
          { id: "item-1", productName: "Wiring Repair", variantLabel: "Standard", price: 600.0, quantity: 1 }
        ],
        statusHistory: [],
        riderName: "Tech Bob"
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/orders/order-booking-user-1") return Promise.resolve({ data: mockOrderDetailData });
      if (url.includes("/orders")) return Promise.resolve({ data: mockUserOrdersData });
      if (url.includes("/consents")) return Promise.resolve({ data: mockConsentsData });
      return Promise.resolve({ data: mockUserData });
    });

    renderAdminUserDetail();

    const viewBtn = await screen.findByTestId("view-user-order-order-101");
    // We mock that order-101 details route returns BOOKING order details for order-booking-user-1
    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/orders/order-101") return Promise.resolve({ data: mockOrderDetailData });
      if (url.includes("/orders")) return Promise.resolve({ data: mockUserOrdersData });
      if (url.includes("/consents")) return Promise.resolve({ data: mockConsentsData });
      return Promise.resolve({ data: mockUserData });
    });

    fireEvent.click(viewBtn);

    const modal = await screen.findByTestId("user-order-details-modal");
    expect(modal).toBeInTheDocument();
    expect(await within(modal).findByText("Service Fee")).toBeInTheDocument();
    expect(within(modal).queryByText("Delivery Fee")).not.toBeInTheDocument();
  });

  it("renders status badges formatted by commerce type and renamed filter options in buyer orders table", async () => {
    const mockOrdersMultiType = {
      success: true,
      data: {
        items: [
          {
            id: "order-booking-1",
            storeId: "store-repair",
            storeName: "GoRola Repairs",
            total: 1299.10,
            subtotal: 1200.0,
            deliveryFee: 99.10,
            status: "OUT_FOR_DELIVERY",
            orderType: "BOOKING",
            paymentMethod: "COD",
            itemsCount: 1,
            createdAt: "2026-10-15T10:00:00.000Z"
          },
          {
            id: "order-booking-2",
            storeId: "store-repair",
            storeName: "GoRola Repairs",
            total: 649.0,
            subtotal: 600.0,
            deliveryFee: 49.0,
            status: "DELIVERED",
            orderType: "BOOKING",
            paymentMethod: "COD",
            itemsCount: 1,
            createdAt: "2026-10-15T11:00:00.000Z"
          },
          {
            id: "order-quick-1",
            storeId: "store-grocery",
            storeName: "Hillside Mart",
            total: 980.0,
            subtotal: 950.0,
            deliveryFee: 30.0,
            status: "OUT_FOR_DELIVERY",
            orderType: "QUICK",
            paymentMethod: "COD",
            itemsCount: 2,
            createdAt: "2026-10-15T12:00:00.000Z"
          }
        ],
        total: 3,
        page: 1,
        limit: 20,
        totalPages: 1
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/orders")) return Promise.resolve({ data: mockOrdersMultiType });
      if (url.includes("/consents")) return Promise.resolve({ data: mockConsentsData });
      return Promise.resolve({ data: mockUserData });
    });

    renderAdminUserDetail();

    const table = await screen.findByTestId("user-orders-table");
    expect(table).toBeInTheDocument();

    // Verify filter options
    const filterSelect = screen.getByTestId("user-orders-status-filter");
    expect(within(filterSelect).getByText("Out for Delivery / On The Way")).toBeInTheDocument();
    expect(within(filterSelect).getByText("Delivered / Completed")).toBeInTheDocument();

    // Verify commerce-type aware status labels in table
    expect(within(table).getByText("On The Way")).toBeInTheDocument();
    expect(within(table).getByText("Completed")).toBeInTheDocument();
    expect(within(table).getByText("Out For Delivery")).toBeInTheDocument();
  });

  it("supports switching between Table and Cards view mode and always displays persistent pagination", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/orders")) return Promise.resolve({ data: mockUserOrdersData });
      if (url.includes("/consents")) return Promise.resolve({ data: mockConsentsData });
      return Promise.resolve({ data: mockUserData });
    });

    renderAdminUserDetail();

    // Verify table is initially rendered
    expect(await screen.findByTestId("user-orders-table")).toBeInTheDocument();
    expect(screen.queryByTestId("user-orders-cards")).not.toBeInTheDocument();

    // Verify persistent pagination bar even for 1 order / totalPages = 1
    const pagination = screen.getByTestId("user-orders-pagination");
    expect(pagination).toBeInTheDocument();
    expect(pagination).toHaveTextContent(/page 1 of 1/i);
    expect(screen.getByTestId("user-orders-pagination-prev")).toBeDisabled();
    expect(screen.getByTestId("user-orders-pagination-next")).toBeDisabled();

    // Toggle to cards view
    const cardsBtn = screen.getByTestId("user-orders-view-cards");
    fireEvent.click(cardsBtn);

    // Cards should now be visible and table hidden
    expect(await screen.findByTestId("user-orders-cards")).toBeInTheDocument();
    expect(screen.queryByTestId("user-orders-table")).not.toBeInTheDocument();
    expect(screen.getByTestId("user-order-card-order-101")).toBeInTheDocument();

    // Toggle back to table view
    const tableBtn = screen.getByTestId("user-orders-view-table");
    fireEvent.click(tableBtn);
    expect(await screen.findByTestId("user-orders-table")).toBeInTheDocument();
  });
});
