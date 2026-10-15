import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStoreDetailPage } from "./AdminStoreDetailPage";

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    put: putMock
  }
}));

// Mock toast notification
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

function renderAdminStoreDetailPage(storeId: string): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter initialEntries={[`/admin/stores/${storeId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/stores/:id" element={<AdminStoreDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminStoreDetailPage Override Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
    putMock.mockReset();
  });

  it("renders store details and rider earning rate override card with correct initial value", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          name: "Test Store",
          description: "Description",
          phone: "+919000000000",
          address: "Address",
          storeType: "QUICK_COMMERCE",
          isActive: true,
          createdAt: "2026-07-14T00:00:00Z",
          revenue: 1000,
          productCount: 15,
          orderCount: 10,
          owners: [],
          riderEarningRatePct: 90.00
        }
      }
    });

    renderAdminStoreDetailPage("store-1");

    expect(await screen.findByText("Test Store")).toBeInTheDocument();

    const input = screen.getByTestId("store-rider-earning-rate-input") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("90");
  });

  it("submits the form with custom percentage value on save", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          name: "Test Store",
          description: "Description",
          phone: "+919000000000",
          address: "Address",
          storeType: "QUICK_COMMERCE",
          isActive: true,
          createdAt: "2026-07-14T00:00:00Z",
          revenue: 1000,
          productCount: 15,
          orderCount: 10,
          owners: [],
          riderEarningRatePct: null
        }
      }
    });

    putMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          riderEarningRatePct: 85.00
        }
      }
    });

    renderAdminStoreDetailPage("store-1");

    expect(await screen.findByText("Test Store")).toBeInTheDocument();

    const input = screen.getByTestId("store-rider-earning-rate-input") as HTMLInputElement;
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { value: "85" } });
    expect(input.value).toBe("85");

    const saveBtn = screen.getByRole("button", { name: /save earning rate/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/stores/store-1/rider-earning-rate", {
        riderEarningRatePct: 85
      });
    });
  });

  it("submits the form with null when input is cleared", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          name: "Test Store",
          description: "Description",
          phone: "+919000000000",
          address: "Address",
          storeType: "QUICK_COMMERCE",
          isActive: true,
          createdAt: "2026-07-14T00:00:00Z",
          revenue: 1000,
          productCount: 15,
          orderCount: 10,
          owners: [],
          riderEarningRatePct: 90.00
        }
      }
    });

    putMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          riderEarningRatePct: null
        }
      }
    });

    renderAdminStoreDetailPage("store-1");

    expect(await screen.findByText("Test Store")).toBeInTheDocument();

    const input = screen.getByTestId("store-rider-earning-rate-input") as HTMLInputElement;
    expect(input.value).toBe("90");

    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");

    const saveBtn = screen.getByRole("button", { name: /save earning rate/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/stores/store-1/rider-earning-rate", {
        riderEarningRatePct: null
      });
    });
  });

  it("renders paginated store orders table and opens order details modal", async () => {
    const mockStoreData = {
      id: "store-1",
      name: "Test Store",
      description: "Description",
      phone: "+919000000000",
      address: "Address",
      storeType: "QUICK_COMMERCE",
      isActive: true,
      createdAt: "2026-07-14T00:00:00Z",
      revenue: 1000,
      productCount: 15,
      orderCount: 10,
      owners: [],
      riderEarningRatePct: null
    };

    const mockOrdersData = {
      items: [
        {
          id: "store-ord-501",
          orderNumber: "store-ord-501",
          status: "DELIVERED",
          orderType: "QUICK",
          createdAt: "2026-07-14T10:00:00Z",
          total: 520.0,
          subtotal: 490.0,
          deliveryFee: 30.0,
          paymentMethod: "COD",
          storeName: "Test Store",
          storeId: "store-1",
          userName: "Store Customer",
          userMaskedPhone: "*********3210",
          riderName: "Hillside Rider",
          itemCount: 2
        }
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1
    };

    const mockOrderDetailData = {
      id: "store-ord-501",
      status: "DELIVERED",
      orderType: "QUICK",
      subtotal: 490.0,
      deliveryFee: 30.0,
      total: 520.0,
      paymentMethod: "COD",
      landmarkDescription: "Near Church",
      flatRoom: "House 10",
      createdAt: "2026-07-14T10:00:00Z",
      buyerMaskedPhone: "*********3210",
      store: { name: "Test Store", phone: "+919000000000" },
      items: [
        { id: "item-1", productName: "Organic Milk", variantLabel: "1L", price: 60.0, quantity: 2 }
      ],
      statusHistory: [
        { id: "hist-1", status: "PLACED", changedBy: "Buyer (Store Customer)", changedAt: "2026-07-14T10:00:00Z" }
      ],
      riderName: "Hillside Rider"
    };

    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/orders/store-ord-501") {
        return Promise.resolve({ data: { success: true, data: mockOrderDetailData } });
      }
      if (url.includes("/api/v1/admin/stores/store-1/orders")) {
        return Promise.resolve({ data: { success: true, data: mockOrdersData } });
      }
      if (url.includes("/api/v1/admin/stores/store-1")) {
        return Promise.resolve({ data: { success: true, data: mockStoreData } });
      }
      return Promise.reject(new Error("Unknown url " + url));
    });

    renderAdminStoreDetailPage("store-1");

    // Verify Orders section
    expect(await screen.findByTestId("store-orders-table")).toBeInTheDocument();
    expect(screen.getByText("Store Customer")).toBeInTheDocument();
    expect(screen.getByText(/520\.00/)).toBeInTheDocument();

    // Open modal
    const viewBtn = screen.getByTestId("view-store-order-store-ord-501");
    fireEvent.click(viewBtn);

    const modal = await screen.findByTestId("store-order-details-modal");
    expect(modal).toBeInTheDocument();
    expect(await screen.findByText("Organic Milk")).toBeInTheDocument();
    expect(within(modal).getByText("Delivery Fee")).toBeInTheDocument();
  });

  it("renders 'Service Fee' for BOOKING orders in store order details modal", async () => {
    const mockStoreData = {
      id: "store-2",
      name: "GoRola Repairs",
      description: "Repair services",
      phone: "+919000000000",
      address: "Address",
      storeType: "SERVICE",
      isActive: true,
      createdAt: "2026-07-14T00:00:00Z",
      revenue: 500,
      productCount: 5,
      orderCount: 2,
      owners: [],
      riderEarningRatePct: null
    };

    const mockOrdersData = {
      items: [
        {
          id: "store-booking-1",
          orderNumber: "store-booking-1",
          status: "DELIVERED",
          orderType: "BOOKING",
          createdAt: "2026-07-14T10:00:00Z",
          total: 550.0,
          subtotal: 500.0,
          deliveryFee: 50.0,
          paymentMethod: "COD",
          storeName: "GoRola Repairs",
          storeId: "store-2",
          userName: "Service Customer",
          userMaskedPhone: "*********3210",
          riderName: "Tech Bob",
          itemCount: 1
        }
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1
    };

    const mockOrderDetailData = {
      id: "store-booking-1",
      status: "DELIVERED",
      orderType: "BOOKING",
      subtotal: 500.0,
      deliveryFee: 50.0,
      total: 550.0,
      paymentMethod: "COD",
      landmarkDescription: "Near Mall",
      flatRoom: "House 22",
      createdAt: "2026-07-14T10:00:00Z",
      buyerMaskedPhone: "*********3210",
      store: { name: "GoRola Repairs", phone: "+919000000000" },
      items: [
        { id: "item-1", productName: "Fan Repair", variantLabel: "Standard", price: 500.0, quantity: 1 }
      ],
      statusHistory: [],
      riderName: "Tech Bob"
    };

    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/admin/orders/store-booking-1") {
        return Promise.resolve({ data: { success: true, data: mockOrderDetailData } });
      }
      if (url.includes("/api/v1/admin/stores/store-2/orders")) {
        return Promise.resolve({ data: { success: true, data: mockOrdersData } });
      }
      if (url.includes("/api/v1/admin/stores/store-2")) {
        return Promise.resolve({ data: { success: true, data: mockStoreData } });
      }
      return Promise.reject(new Error("Unknown url " + url));
    });

    renderAdminStoreDetailPage("store-2");

    expect(await screen.findByTestId("store-orders-table")).toBeInTheDocument();
    const viewBtn = screen.getByTestId("view-store-order-store-booking-1");
    fireEvent.click(viewBtn);

    const modal = await screen.findByTestId("store-order-details-modal");
    expect(modal).toBeInTheDocument();
    expect(await within(modal).findByText("Service Fee")).toBeInTheDocument();
    expect(within(modal).queryByText("Delivery Fee")).not.toBeInTheDocument();
  });

  it("renders status badges formatted by commerce type and renamed filter options in store orders table", async () => {
    const mockStoreBooking = {
      id: "store-booking-node",
      name: "Mussoorie Repairs Hub",
      description: "Appliance Repair",
      phone: "+919876543210",
      address: "Mall Road",
      storeType: "BOOKING_COMMERCE",
      isActive: true,
      createdAt: "2026-07-14T00:00:00Z",
      revenue: 5000,
      productCount: 5,
      orderCount: 2,
      owners: [],
      riderEarningRatePct: 90.00
    };

    const mockOrdersBookingStore = {
      items: [
        {
          id: "bk-ord-1",
          orderNumber: "bk-ord-1",
          status: "OUT_FOR_DELIVERY",
          orderType: "BOOKING",
          createdAt: "2026-10-15T10:00:00Z",
          total: 1299.10,
          subtotal: 1200.0,
          deliveryFee: 99.10,
          paymentMethod: "COD",
          storeName: "Mussoorie Repairs Hub",
          storeId: "store-booking-node",
          userName: "Registered User",
          userMaskedPhone: "*********7890",
          riderName: "Tech Bob",
          itemCount: 1
        },
        {
          id: "bk-ord-2",
          orderNumber: "bk-ord-2",
          status: "DELIVERED",
          orderType: "BOOKING",
          createdAt: "2026-10-15T11:00:00Z",
          total: 649.0,
          subtotal: 600.0,
          deliveryFee: 49.0,
          paymentMethod: "COD",
          storeName: "Mussoorie Repairs Hub",
          storeId: "store-booking-node",
          userName: "Registered User",
          userMaskedPhone: "*********7890",
          riderName: "Tech Bob",
          itemCount: 1
        }
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/api/v1/admin/stores/store-booking-node/orders")) {
        return Promise.resolve({ data: { success: true, data: mockOrdersBookingStore } });
      }
      if (url.includes("/api/v1/admin/stores/store-booking-node")) {
        return Promise.resolve({ data: { success: true, data: mockStoreBooking } });
      }
      return Promise.reject(new Error("Unknown url " + url));
    });

    renderAdminStoreDetailPage("store-booking-node");

    const table = await screen.findByTestId("store-orders-table");
    expect(table).toBeInTheDocument();

    // Verify filter options
    const filterSelect = screen.getByTestId("store-orders-status-filter");
    expect(within(filterSelect).getByText("Out for Delivery / On The Way")).toBeInTheDocument();
    expect(within(filterSelect).getByText("Delivered / Completed")).toBeInTheDocument();

    // Verify status labels in table for BOOKING_COMMERCE store
    expect(within(table).getByText("On The Way")).toBeInTheDocument();
    expect(within(table).getByText("Completed")).toBeInTheDocument();
  });

  it("supports switching between Table and Cards view mode and renders persistent pagination", async () => {
    const mockStore = {
      id: "store-toggle-test",
      name: "Toggle Store",
      description: "Description",
      phone: "+919000000000",
      address: "Address",
      storeType: "QUICK_COMMERCE",
      isActive: true,
      createdAt: "2026-07-14T00:00:00Z",
      revenue: 1000,
      productCount: 15,
      orderCount: 10,
      owners: [],
      riderEarningRatePct: null
    };

    const mockOrders = {
      items: [
        {
          id: "store-toggle-ord-1",
          orderNumber: "ord-1",
          status: "DELIVERED",
          orderType: "QUICK",
          createdAt: "2026-07-14T10:00:00Z",
          total: 350.0,
          subtotal: 320.0,
          deliveryFee: 30.0,
          paymentMethod: "COD",
          storeName: "Toggle Store",
          storeId: "store-toggle-test",
          userName: "Customer A",
          userMaskedPhone: "*********1234",
          riderName: "Rider 1",
          itemCount: 2
        }
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/orders")) {
        return Promise.resolve({ data: { success: true, data: mockOrders } });
      }
      return Promise.resolve({ data: { success: true, data: mockStore } });
    });

    renderAdminStoreDetailPage("store-toggle-test");

    // Table view by default
    expect(await screen.findByTestId("store-orders-table")).toBeInTheDocument();
    expect(screen.queryByTestId("store-orders-cards")).not.toBeInTheDocument();

    // Persistent pagination bar
    const pagination = screen.getByTestId("store-orders-pagination");
    expect(pagination).toBeInTheDocument();
    expect(pagination).toHaveTextContent(/page 1 of 1/i);
    expect(screen.getByTestId("store-orders-pagination-prev")).toBeDisabled();
    expect(screen.getByTestId("store-orders-pagination-next")).toBeDisabled();

    // Toggle to cards view
    const cardsBtn = screen.getByTestId("store-orders-view-cards");
    fireEvent.click(cardsBtn);

    expect(await screen.findByTestId("store-orders-cards")).toBeInTheDocument();
    expect(screen.queryByTestId("store-orders-table")).not.toBeInTheDocument();
    expect(screen.getByTestId("store-order-card-store-toggle-ord-1")).toBeInTheDocument();

    // Toggle back to table view
    const tableBtn = screen.getByTestId("store-orders-view-table");
    fireEvent.click(tableBtn);
    expect(await screen.findByTestId("store-orders-table")).toBeInTheDocument();
  });
});
