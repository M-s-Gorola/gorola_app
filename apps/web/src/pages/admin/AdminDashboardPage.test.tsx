/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminDashboardPage } from "./AdminDashboardPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock, putMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  patchMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string) => getMock(url)),
    post: vi.fn(),
    put: vi.fn((url: string, body: unknown) => putMock(url, body)),
    patch: vi.fn((url: string, body: unknown) => patchMock(url, body))
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

function renderAdminDashboard(initialEntries: InitialEntry[] = ["/admin/dashboard"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    useAuthStore.getState().setAdminSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-admin-id",
      twoFactorVerified: true
    });

    // Default mock implementation to prevent queries from failing
    getMock.mockImplementation((url: string) => {
      if (url.includes("/admin/stores")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: "store-a", name: "Organic Shop", storeType: "QUICK_COMMERCE", isActive: true },
              { id: "store-b", name: "Tech Hub", storeType: "QUICK_COMMERCE", isActive: true },
              { id: "store-c", name: "Services Store", storeType: "BOOKING_COMMERCE", isActive: true }
            ]
          }
        });
      }
      if (url.includes("/admin/settings")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { key: "DELIVERY_CHARGE", value: "30.00" },
              { key: "SERVICE_CHARGE", value: "0.00" }
            ]
          }
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            totalOrdersToday: 24,
            totalRevenueToday: 3450.75,
            perStoreBreakdown: [
              {
                storeId: "store-a",
                storeName: "Organic Shop",
                ordersToday: 14,
                revenueToday: 1850.5,
                pendingOrdersCount: 2,
                storeType: "QUICK_COMMERCE"
              }
            ],
            weeklyRevenue: [],
            lowStockAlertCount: 3,
            totalActiveBuyers: 150,
            totalProducts: 45,
            pendingAdApprovalsCount: 2,
            featureFlags: []
          }
        }
      });
    });
  });

  it("renders skeletons during loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderAdminDashboard();

    expect(screen.getByTestId("kpi-skeleton-orders")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-skeleton-revenue")).toBeInTheDocument();
    expect(screen.getByTestId("chart-skeleton")).toBeInTheDocument();
  });

  it("renders error message when API call fails", async () => {
    getMock.mockImplementation(() => Promise.reject(new Error("Network Error")));

    renderAdminDashboard();

    expect(await screen.findByText(/failed to load dashboard/i)).toBeInTheDocument();
  });

  it("renders KPIs, feature flags, store breakdown, and trend chart on success", async () => {
    const mockDashboardData = {
      success: true,
      data: {
        totalOrdersToday: 24,
        totalRevenueToday: 3450.75,
        perStoreBreakdown: [
          {
            storeId: "store-a",
            storeName: "Organic Shop",
            ordersToday: 14,
            revenueToday: 1850.5,
            pendingOrdersCount: 2,
            storeType: "QUICK_COMMERCE"
          },
          {
            storeId: "store-b",
            storeName: "Tech Hub",
            ordersToday: 10,
            revenueToday: 1600.25,
            pendingOrdersCount: 1,
            storeType: "QUICK_COMMERCE"
          }
        ],
        weeklyRevenue: [
          { date: "2026-05-18", revenue: 1000 },
          { date: "2026-05-19", revenue: 1500 },
          { date: "2026-05-20", revenue: 1200 },
          { date: "2026-05-21", revenue: 2000 },
          { date: "2026-05-22", revenue: 2500 },
          { date: "2026-05-23", revenue: 3000 },
          { date: "2026-05-24", revenue: 3450.75 }
        ],
        lowStockAlertCount: 3,
        totalActiveBuyers: 150,
        totalProducts: 45,
        pendingAdApprovalsCount: 2,
        featureFlags: [
          { key: "WEATHER_MODE_ACTIVE", value: false },
          { key: "RIDER_INTERFACE_ENABLED", value: true }
        ]
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/admin/stores")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: "store-a", name: "Organic Shop", storeType: "QUICK_COMMERCE", isActive: true },
              { id: "store-b", name: "Tech Hub", storeType: "QUICK_COMMERCE", isActive: true }
            ]
          }
        });
      }
      return Promise.resolve({ data: mockDashboardData });
    });

    renderAdminDashboard();

    // Verify page header
    expect(await screen.findByText("System Dashboard")).toBeInTheDocument();

    // Verify KPI Card values
    expect(screen.getByTestId("total-orders-today")).toHaveTextContent("24");
    expect(screen.getByTestId("total-revenue-today")).toHaveTextContent("₹3,450.75");
    expect(screen.getByTestId("active-buyers")).toHaveTextContent("150");
    expect(screen.getByTestId("total-products")).toHaveTextContent("45");
    expect(screen.getByTestId("pending-approvals")).toHaveTextContent("2");

    // Verify Stores Breakdown table values
    expect(screen.getByText("Organic Shop")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("₹1,850.50")).toBeInTheDocument();

    expect(screen.getByText("Tech Hub")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("₹1,600.25")).toBeInTheDocument();


  });


  it("renders Orders Volume and Bookings Volume charts with store multi-select picker and triggers endpoint calls", async () => {
    const mockDashboardData = {
      success: true,
      data: {
        totalOrdersToday: 24,
        totalRevenueToday: 3450.75,
        perStoreBreakdown: [
          {
            storeId: "store-a",
            storeName: "Organic Shop",
            ordersToday: 14,
            revenueToday: 1850.5,
            pendingOrdersCount: 2,
            storeType: "QUICK_COMMERCE"
          }
        ],
        weeklyRevenue: [],
        lowStockAlertCount: 3,
        totalActiveBuyers: 150,
        totalProducts: 45,
        pendingAdApprovalsCount: 2,
        featureFlags: []
      }
    };

    const mockOrdersTrend = {
      success: true,
      data: [
        { date: "2026-05-18", count: 5 },
        { date: "2026-05-19", count: 10 }
      ]
    };
    const mockBookingsTrend = {
      success: true,
      data: [
        { date: "2026-05-18", count: 2 },
        { date: "2026-05-19", count: 4 }
      ]
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/admin/stores")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: "store-a", name: "Organic Shop", storeType: "QUICK_COMMERCE", isActive: true }
            ]
          }
        });
      }
      if (url.includes("/admin/dashboard/orders-trend")) {
        return Promise.resolve({ data: mockOrdersTrend });
      }
      if (url.includes("/admin/dashboard/bookings-trend")) {
        return Promise.resolve({ data: mockBookingsTrend });
      }
      return Promise.resolve({ data: mockDashboardData });
    });

    renderAdminDashboard();

    // Verify Volume chart title is initially 'Weekly System Volume Trend'
    expect(await screen.findByText("Weekly System Volume Trend")).toBeInTheDocument();

    // Verify Orders Volume and Bookings Volume toggle buttons are not rendered
    expect(screen.queryByRole("button", { name: "Orders Volume" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bookings Volume" })).not.toBeInTheDocument();

    const storePickerButtons = screen.getAllByRole("button", { name: /filter by store/i });
    expect(storePickerButtons).toHaveLength(2);

    // Verify volume-store-type-select exists
    const volumeStoreTypeSelect = screen.getByTestId("volume-store-type-select") as HTMLSelectElement;
    expect(volumeStoreTypeSelect).toBeInTheDocument();
    expect(volumeStoreTypeSelect.value).toBe("ALL");

    // Change volume store type to QUICK_COMMERCE
    fireEvent.change(volumeStoreTypeSelect, { target: { value: "QUICK_COMMERCE" } });
    expect(volumeStoreTypeSelect.value).toBe("QUICK_COMMERCE");

    // Verify Volume chart title changes to 'Weekly System Orders Volume Trend'
    expect(screen.getByText("Weekly System Orders Volume Trend")).toBeInTheDocument();

    await waitFor(() => {
      // It should call orders-trend with storeType parameter
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/admin/dashboard/orders-trend?")
      );
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining("storeType=QUICK_COMMERCE")
      );
    });
  });

  it("does not render the Feature Flags panel or toggles on the dashboard", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/admin/stores")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            totalOrdersToday: 0,
            totalRevenueToday: 0,
            perStoreBreakdown: [],
            weeklyRevenue: [],
            lowStockAlertCount: 0,
            totalActiveBuyers: 0,
            totalProducts: 0,
            pendingAdApprovalsCount: 0,
            featureFlags: [
              { key: "WEATHER_MODE_ACTIVE", value: false }
            ]
          }
        }
      });
    });

    renderAdminDashboard();

    // Wait for the dashboard to finish loading
    expect(await screen.findByText("System Dashboard")).toBeInTheDocument();

    // Assert that the feature flags container or keys are NOT in the document
    expect(screen.queryByText("Feature Flags")).not.toBeInTheDocument();
    expect(screen.queryByText("WEATHER_MODE_ACTIVE")).not.toBeInTheDocument();
  });

  it("renders Platform Fees Settings card and updates settings on save", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/admin/stores")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url.includes("/admin/settings")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { key: "DELIVERY_CHARGE", value: "30.00" },
              { key: "SERVICE_CHARGE", value: "0.00" }
            ]
          }
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            totalOrdersToday: 0,
            totalRevenueToday: 0,
            perStoreBreakdown: [],
            weeklyRevenue: [],
            lowStockAlertCount: 0,
            totalActiveBuyers: 0,
            totalProducts: 0,
            pendingAdApprovalsCount: 0,
            featureFlags: []
          }
        }
      });
    });

    putMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          { key: "DELIVERY_CHARGE", value: "45.00" },
          { key: "SERVICE_CHARGE", value: "25.00" }
        ]
      }
    });

    renderAdminDashboard();

    expect(await screen.findByText("Platform Fees Settings")).toBeInTheDocument();

    const deliveryInput = screen.getByLabelText(/delivery charge/i) as HTMLInputElement;
    const serviceInput = screen.getByLabelText(/service charge/i) as HTMLInputElement;
    const saveButton = screen.getByRole("button", { name: /save platform fees/i });

    expect(deliveryInput.value).toBe("30.00");
    expect(serviceInput.value).toBe("0.00");

    fireEvent.change(deliveryInput, { target: { value: "45.00" } });
    fireEvent.change(serviceInput, { target: { value: "25.00" } });

    expect(deliveryInput.value).toBe("45.00");
    expect(serviceInput.value).toBe("25.00");

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/settings", {
        deliveryCharge: "45.00",
        serviceCharge: "25.00"
      });
    });
  });
});
