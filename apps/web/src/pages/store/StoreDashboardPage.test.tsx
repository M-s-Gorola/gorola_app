/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreDashboardPage } from "./StoreDashboardPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: vi.fn()
  }
}));

function renderStoreDashboard(initialEntries: InitialEntry[] = ["/store/dashboard"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/dashboard" element={<StoreDashboardPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreDashboardPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthStore.getState().setStoreOwnerSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-user-id",
      storeId: "mock-store-id"
    });
  });

  it("renders skeletons during loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderStoreDashboard();

    expect(screen.getByTestId("kpi-skeleton-orders")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-skeleton-revenue")).toBeInTheDocument();
    expect(screen.getByTestId("chart-skeleton")).toBeInTheDocument();
  });

  it("renders error message when API call fails", async () => {
    getMock.mockRejectedValueOnce(new Error("Network Error"));

    renderStoreDashboard();

    expect(await screen.findByText(/failed to load dashboard/i)).toBeInTheDocument();
  });

  it("renders metrics, low stock, and top products on successful API response", async () => {
    const mockDashboardData = {
      success: true,
      data: {
        todayOrderCount: 15,
        todayRevenue: 1250.5,
        pendingOrdersCount: 4,
        weeklyRevenue: [
          { date: "2026-05-13", revenue: 400 },
          { date: "2026-05-14", revenue: 500 },
          { date: "2026-05-15", revenue: 600 },
          { date: "2026-05-16", revenue: 800 },
          { date: "2026-05-17", revenue: 700 },
          { date: "2026-05-18", revenue: 950 },
          { date: "2026-05-19", revenue: 1250.5 }
        ],
        topProducts: [
          { name: "Organic Bananas", soldCount: 42 },
          { name: "Fresh Strawberries", soldCount: 30 },
          { name: "Whole Milk", soldCount: 25 }
        ],
        lowStockItems: [
          { productName: "Avocados", variantLabel: "Pack of 3", stockQty: 2 },
          { productName: "Whole Milk", variantLabel: "1 Gallon", stockQty: 4 }
        ],
        activeAdvertisementsCount: 2,
        activeOffersCount: 3
      }
    };

    getMock.mockResolvedValueOnce({ data: mockDashboardData });

    renderStoreDashboard();

    // Verify KPI Cards
    expect(await screen.findByText("15")).toBeInTheDocument(); // orders count
    expect(screen.getByText("₹1,250.50")).toBeInTheDocument(); // revenue
    expect(screen.getByText("4")).toBeInTheDocument(); // pending orders
    expect(screen.getByText("2")).toBeInTheDocument(); // active ads
    expect(screen.getByText("3")).toBeInTheDocument(); // active offers

    // Verify Low Stock alerts
    expect(screen.getByText("Avocados")).toBeInTheDocument();
    expect(screen.getByText("Pack of 3")).toBeInTheDocument();
    expect(screen.getByText("Stock: 2")).toBeInTheDocument();

    expect(screen.getByText("Whole Milk")).toBeInTheDocument();
    expect(screen.getByText("1 Gallon")).toBeInTheDocument();
    expect(screen.getByText("Stock: 4")).toBeInTheDocument();

    // Verify Top Products list
    expect(screen.getByText("Organic Bananas")).toBeInTheDocument();
    expect(screen.getByText("42 sold")).toBeInTheDocument();
    expect(screen.getByText("Fresh Strawberries")).toBeInTheDocument();
    expect(screen.getByText("30 sold")).toBeInTheDocument();
  });

  it("subscribes to socket events and invalidates query client on new orders or updates", async () => {
    const mockDashboardData = {
      success: true,
      data: {
        todayOrderCount: 15,
        todayRevenue: 1250.5,
        pendingOrdersCount: 4,
        weeklyRevenue: [],
        topProducts: [],
        lowStockItems: [],
        activeAdvertisementsCount: 2,
        activeOffersCount: 3
      }
    };

    getMock.mockResolvedValue({ data: mockDashboardData });

    // Spy/mock socket.io-client io function
    const socketListeners: Record<string, (...args: unknown[]) => void> = {};
    const mockSocket = {
      on: vi.fn((event, cb) => {
        socketListeners[event] = cb;
      }),
      emit: vi.fn(),
      disconnect: vi.fn()
    };
    
    const socketIoClient = await import("socket.io-client");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(socketIoClient, "io").mockReturnValue(mockSocket as any);

    renderStoreDashboard();

    // Verify initial load
    expect(await screen.findByText("15")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);

    // Verify socket connection and room subscription occurred
    expect(socketIoClient.io).toHaveBeenCalled();
    expect(mockSocket.on).toHaveBeenCalledWith("store:new_order", expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith("store:order_updated", expect.any(Function));

    // Simulate "store:new_order" socket event
    const newOrderCallback = socketListeners["store:new_order"];
    expect(newOrderCallback).toBeTypeOf("function");
    if (newOrderCallback) {
      newOrderCallback();
    }

    // Assert that a refresh (refetch) is triggered, calling API get again
    await vi.waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(2);
    });

    // Simulate "store:order_updated" socket event
    const orderUpdatedCallback = socketListeners["store:order_updated"];
    expect(orderUpdatedCallback).toBeTypeOf("function");
    if (orderUpdatedCallback) {
      orderUpdatedCallback();
    }

    await vi.waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(3);
    });
  });
});
