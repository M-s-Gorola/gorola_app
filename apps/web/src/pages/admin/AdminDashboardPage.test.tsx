/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminDashboardPage } from "./AdminDashboardPage";
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
  });

  it("renders skeletons during loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderAdminDashboard();

    expect(screen.getByTestId("kpi-skeleton-orders")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-skeleton-revenue")).toBeInTheDocument();
    expect(screen.getByTestId("chart-skeleton")).toBeInTheDocument();
  });

  it("renders error message when API call fails", async () => {
    getMock.mockRejectedValueOnce(new Error("Network Error"));

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
            pendingOrdersCount: 2
          },
          {
            storeId: "store-b",
            storeName: "Tech Hub",
            ordersToday: 10,
            revenueToday: 1600.25,
            pendingOrdersCount: 1
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

    getMock.mockResolvedValueOnce({ data: mockDashboardData });

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

    // Verify Feature Flags section
    expect(screen.getByText("WEATHER_MODE_ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("RIDER_INTERFACE_ENABLED")).toBeInTheDocument();
  });

  it("handles toggling feature flags with confirmation dialogs and triggers PUT requests", async () => {
    const mockDashboardData = {
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
    };

    getMock.mockResolvedValue({ data: mockDashboardData });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminDashboard();

    const toggleButton = await screen.findByRole("switch", { name: /toggle flag WEATHER_MODE_ACTIVE/i });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-checked", "false");

    // Click toggle to turn on
    fireEvent.click(toggleButton);

    // Verify confirmation modal is shown
    expect(screen.getByText("Confirm Feature Flag Update")).toBeInTheDocument();
    expect(screen.getByText(/Activating Weather Mode has high system impact/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Confirm Update" });
    fireEvent.click(confirmButton);

    // Verify PUT request is made
    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/feature-flags/WEATHER_MODE_ACTIVE", { value: true });
    });
  });
});
