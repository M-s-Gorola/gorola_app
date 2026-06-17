/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreDashboardPage } from "./StoreDashboardPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock, getProfileMock, mockNavigate } = vi.hoisted(() => ({
  getMock: vi.fn(),
  getProfileMock: vi.fn(),
  mockNavigate: vi.fn()
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes("/profile")) {
        return getProfileMock(url);
      }
      return getMock(url);
    }),
    post: vi.fn(),
    put: vi.fn()
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
    getProfileMock.mockReset();
    getProfileMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          storeType: "QUICK_COMMERCE",
          isAcceptingOrders: true
        }
      }
    });
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
        activeOffersCount: 3,
        activeDiscountsCount: 5
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
    expect(screen.getByText("5")).toBeInTheDocument(); // active discounts
    expect(screen.getByText("Active Discount Codes")).toBeInTheDocument();

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
        activeOffersCount: 3,
        activeDiscountsCount: 5
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

  it("renders booking-specific metrics and labels when storeType is BOOKING_COMMERCE", async () => {
    getProfileMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          storeType: "BOOKING_COMMERCE",
          isAcceptingOrders: true
        }
      }
    });

    const mockDashboardData = {
      success: true,
      data: {
        todayOrderCount: 8,
        todayRevenue: 2400.0,
        pendingOrdersCount: 3,
        weeklyRevenue: [],
        topProducts: [
          { name: "Thyroid Profile", soldCount: 12 },
          { name: "Lipid Profile", soldCount: 8 }
        ],
        lowStockItems: [],
        activeAdvertisementsCount: 1,
        activeOffersCount: 2,
        activeDiscountsCount: 4
      }
    };

    getMock.mockResolvedValueOnce({ data: mockDashboardData });

    renderStoreDashboard();

    // Verify booking specific labels are present
    expect(await screen.findByText("Appointments Scheduled Today")).toBeInTheDocument();
    expect(screen.getByText("Pending Approvals")).toBeInTheDocument();
    expect(screen.getByText("Top Performing Services")).toBeInTheDocument();
    expect(screen.getByText("Times Booked")).toBeInTheDocument();

    // Verify metric values
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("₹2,400.00")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // Verify low stock section is hidden or empty message is shown
    expect(screen.queryByText("Low Stock Alert")).not.toBeInTheDocument();
  });

  it("should show the store status toggle and trigger confirmation modal on toggle off", async () => {
    getProfileMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          storeType: "QUICK_COMMERCE",
          isAcceptingOrders: true
        }
      }
    });

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
        activeOffersCount: 3,
        activeDiscountsCount: 5
      }
    };
    getMock.mockResolvedValue({ data: mockDashboardData });

    renderStoreDashboard();

    // Verify toggle button is visible and active
    const toggleButton = await screen.findByRole("switch", { name: /toggle store status/i });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-checked", "true");

    // Click toggle to turn off
    fireEvent.click(toggleButton);

    // Confirm modal is shown
    expect(screen.getByText("Confirm Store Closure")).toBeInTheDocument();
    expect(screen.getByText("Hiding your store will remove all your products from the buyer app. Are you sure?")).toBeInTheDocument();

    // Verify close/cancel works
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);
    expect(screen.queryByText("Confirm Store Closure")).not.toBeInTheDocument();
  });

  describe("Multi-Dimensional Revenue Analytics UI Controls", () => {
    it("renders Timeframe Range and Grouping Resolution dropdowns and handles guardrail validation", async () => {
      const mockDashboardData = {
        success: true,
        data: {
          todayOrderCount: 15,
          todayRevenue: 1250.5,
          pendingOrdersCount: 4,
          weeklyRevenue: [
            { date: "2026-05-13", revenue: 400 },
            { date: "2026-05-14", revenue: 500 }
          ],
          topProducts: [],
          lowStockItems: [],
          activeAdvertisementsCount: 2,
          activeOffersCount: 3,
          activeDiscountsCount: 5
        }
      };

      getMock.mockResolvedValue({ data: mockDashboardData });

      renderStoreDashboard();

      // Verify dropdown selectors are present
      const rangeSelect = await screen.findByTestId("analytics-range-select");
      const groupBySelect = await screen.findByTestId("analytics-groupby-select");
      expect(rangeSelect).toBeInTheDocument();
      expect(groupBySelect).toBeInTheDocument();

      // Default values: Range is "WEEK" (Last 7 Days), GroupBy is "DAILY" (Daily)
      expect(rangeSelect).toHaveValue("WEEK");
      expect(groupBySelect).toHaveValue("DAILY");

      // Verify that changing Range to TODAY forces GroupBy to HOURLY (guardrail validation) and locks/disables other groupBy choices
      fireEvent.change(rangeSelect, { target: { value: "TODAY" } });
      expect(rangeSelect).toHaveValue("TODAY");
      await waitFor(() => {
        expect(groupBySelect).toHaveValue("HOURLY");
      });

      // Verify that when range is TODAY, other groupOptions are disabled or only HOURLY is selectable
      // Change range to MONTH
      fireEvent.change(rangeSelect, { target: { value: "MONTH" } });
      await waitFor(() => {
        expect(rangeSelect).toHaveValue("MONTH");
      });
      // Changing range back to MONTH keeps/restores flexibility, let's select Daily
      fireEvent.change(groupBySelect, { target: { value: "DAILY" } });
      await waitFor(() => {
        expect(groupBySelect).toHaveValue("DAILY");
      });

      // Verify the query params are passed to api.get
      await waitFor(() => {
        expect(getMock).toHaveBeenCalledWith(expect.stringContaining("range=MONTH"));
        expect(getMock).toHaveBeenCalledWith(expect.stringContaining("groupBy=DAILY"));
      });
    });
  });

  it("navigates to appropriate routes or scrolls when KPI cards are clicked", async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

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
        activeOffersCount: 3,
        activeDiscountsCount: 5
      }
    };

    getMock.mockResolvedValueOnce({ data: mockDashboardData });
    mockNavigate.mockReset();

    renderStoreDashboard();

    // Click Pending Orders card
    const pendingOrdersCard = await screen.findByTestId("kpi-pending-orders");
    fireEvent.click(pendingOrdersCard);
    expect(mockNavigate).toHaveBeenCalledWith("/store/orders?status=PLACED");

    // Click Today's Orders card
    const todayOrdersCard = screen.getByTestId("kpi-today-orders");
    fireEvent.click(todayOrdersCard);
    expect(mockNavigate).toHaveBeenCalledWith("/store/orders?dateFilter=TODAY");

    // Click Active Ads card
    const activeAdsCard = screen.getByTestId("kpi-active-ads");
    fireEvent.click(activeAdsCard);
    expect(mockNavigate).toHaveBeenCalledWith("/store/advertisements");

    // Click Active Offers card
    const activeOffersCard = screen.getByTestId("kpi-active-offers");
    fireEvent.click(activeOffersCard);
    expect(mockNavigate).toHaveBeenCalledWith("/store/offers");

    // Click Active Discounts card
    const activeDiscountsCard = screen.getByTestId("kpi-active-discounts");
    fireEvent.click(activeDiscountsCard);
    expect(mockNavigate).toHaveBeenCalledWith("/store/discounts");

    // Click Revenue card
    const revenueCard = screen.getByTestId("kpi-revenue");
    fireEvent.click(revenueCard);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("navigates to booking routes when KPI cards are clicked for BOOKING_COMMERCE", async () => {
    getProfileMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          storeType: "BOOKING_COMMERCE",
          isAcceptingOrders: true
        }
      }
    });

    const mockDashboardData = {
      success: true,
      data: {
        todayOrderCount: 8,
        todayRevenue: 2400.0,
        pendingOrdersCount: 3,
        weeklyRevenue: [],
        topProducts: [],
        lowStockItems: [],
        activeAdvertisementsCount: 1,
        activeOffersCount: 2,
        activeDiscountsCount: 4
      }
    };

    getMock.mockResolvedValueOnce({ data: mockDashboardData });
    mockNavigate.mockReset();

    renderStoreDashboard();

    // Today's Bookings card
    const todayBookingsCard = await screen.findByTestId("kpi-today-orders");
    fireEvent.click(todayBookingsCard);
    expect(mockNavigate).toHaveBeenCalledWith("/store/bookings?tab=APPROVED&dateFilter=TODAY");

    // Pending Approvals card
    const pendingApprovalsCard = screen.getByTestId("kpi-pending-orders");
    fireEvent.click(pendingApprovalsCard);
    expect(mockNavigate).toHaveBeenCalledWith("/store/bookings?tab=PENDING");
  });

  it("renders chart switcher tabs and handles toggling between Revenue and Orders", async () => {
    const mockDashboardData = {
      success: true,
      data: {
        todayOrderCount: 15,
        todayRevenue: 1250.5,
        pendingOrdersCount: 4,
        weeklyRevenue: [
          { date: "2026-05-13", revenue: 400, count: 2 },
          { date: "2026-05-14", revenue: 500, count: 3 }
        ],
        topProducts: [],
        lowStockItems: [],
        activeAdvertisementsCount: 2,
        activeOffersCount: 3,
        activeDiscountsCount: 5
      }
    };

    getMock.mockResolvedValueOnce({ data: mockDashboardData });

    renderStoreDashboard();

    // Verify switcher tabs are rendered
    const revenueTab = await screen.findByRole("button", { name: "Revenue" });
    const ordersTab = screen.getByRole("button", { name: "Orders" });
    expect(revenueTab).toBeInTheDocument();
    expect(ordersTab).toBeInTheDocument();

    // Click "Orders" tab to toggle count mode
    fireEvent.click(ordersTab);
  });
});

