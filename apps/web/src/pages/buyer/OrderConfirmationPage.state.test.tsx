import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Mock, MockInstance } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrderSocket } from "@/hooks/useOrderSocket";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

import { OrderConfirmationPage } from "./OrderConfirmationPage";

// Mock Socket.IO hook
vi.mock("@/hooks/useOrderSocket", () => ({
  useOrderSocket: vi.fn(),
}));

describe("OrderConfirmationPage States", () => {
  let apiGetSpy: MockInstance;
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    vi.clearAllMocks();
    useAuthStore.setState({ isBootstrapPending: false });

    apiGetSpy = vi.spyOn(api!, "get");
  });

  const renderComponent = (id: string) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/order/${id}`]}>
          <Routes>
            <Route path="/order/:id" element={<OrderConfirmationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders 'Thank You' and bloom for PLACED orders", async () => {
    const mockOrder = {
      id: "order-123",
      status: "PLACED",
      createdAt: new Date().toISOString(), // Recently placed
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
    };

    apiGetSpy.mockResolvedValue({
      data: { success: true, data: mockOrder }
    });

    renderComponent("order-123");

    // Check for "Thank You" header
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
    
    // Check for "Bloom" div
    const bloom = document.querySelector(".occ-bloom");
    expect(bloom).toBeInTheDocument();
  });


  it("renders 'Order Delivered' and skips bloom for DELIVERED orders", async () => {
    const mockOrder = {
      id: "order-completed",
      status: "DELIVERED",
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
    };

    apiGetSpy.mockResolvedValue({
      data: { success: true, data: mockOrder }
    });

    renderComponent("order-completed");

    // Should show "Order Delivered"
    expect(await screen.findByText(/order delivered/i)).toBeInTheDocument();

    // Should NOT show "Thank you"
    expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument();

    // Bloom should NOT be in the document
    const bloom = document.querySelector(".occ-bloom");
    expect(bloom).not.toBeInTheDocument();
  });

  it("renders 'Order Delivered' with duration badge for completed orders", async () => {
    const now = Date.now();
    const mockOrder = {
      id: "order-completed-fast",
      status: "DELIVERED",
      createdAt: new Date(now - 3600000).toISOString(),
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
      statusHistory: [
        { changedAt: new Date(now - 3600000).toISOString(), id: "1", status: "PLACED" },
        { changedAt: new Date(now - 1200000).toISOString(), id: "2", status: "DELIVERED" },
      ]
    };

    apiGetSpy.mockResolvedValue({
      data: { success: true, data: mockOrder }
    });

    renderComponent("order-completed-fast");

    expect(await screen.findByText(/order delivered/i)).toBeInTheDocument();
    // 3600000 - 1200000 = 2400000 ms = 40 mins
    expect(await screen.findByText(/delivered in 40m/i)).toBeInTheDocument();
  });

  it("shows full address block with label and flatRoom", async () => {
    const mockOrder = {
      id: "order-addr",
      status: "PLACED",
      createdAt: new Date().toISOString(),
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      addressLabel: "Home",
      flatRoom: "402-A",
      landmarkDescription: "Near Picture Palace",
    };

    apiGetSpy.mockResolvedValue({
      data: { success: true, data: mockOrder }
    });

    renderComponent("order-addr");

    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(await screen.findByText(/402-A, Near Picture Palace/i)).toBeInTheDocument();
  });

  it("renders 'Order Cancelled' state for CANCELLED orders", async () => {
    const mockOrder = {
      id: "order-cancelled",
      status: "CANCELLED",
      createdAt: new Date(Date.now() - 120000).toISOString(),
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
    };

    apiGetSpy.mockResolvedValue({
      data: { success: true, data: mockOrder }
    });

    renderComponent("order-cancelled");

    expect(await screen.findByRole("heading", { name: /order cancelled/i })).toBeInTheDocument();
    expect(screen.getAllByText(/any refunds will be processed/i)[0]).toBeInTheDocument();
    
    // Should NOT show store contact or tracking pulse
    expect(screen.queryByText(/tracking is live/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/call 1234567890/i)).not.toBeInTheDocument();
  });

  it("shows 'Preparing' messaging for PREPARING status", async () => {
    const mockOrder = {
      id: "order-preparing",
      status: "PREPARING",
      createdAt: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
    };

    apiGetSpy.mockResolvedValue({
      data: { success: true, data: mockOrder }
    });

    renderComponent("order-preparing");

    expect(await screen.findByText(/store is picking items/i)).toBeInTheDocument();
    
    // Bloom should be skipped for older non-placed orders
    const bloom = document.querySelector(".occ-bloom");
    expect(bloom).not.toBeInTheDocument();
  });

  it("renders coordinates in rider-location-display when rider location updates", async () => {
    const mockOrder = {
      id: "order-delivering",
      status: "OUT_FOR_DELIVERY",
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
    };

    apiGetSpy.mockImplementation((url: string) => {
      if (url.endsWith("/rider-location")) {
        return Promise.resolve({
          data: { success: true, data: null }
        });
      }
      return Promise.resolve({
        data: { success: true, data: mockOrder }
      });
    });

    renderComponent("order-delivering");

    expect(await screen.findByRole("heading", { name: "On the way" })).toBeInTheDocument();

    expect(useOrderSocket).toHaveBeenCalled();
    const calls = (useOrderSocket as Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBeDefined();
    // The arguments of useOrderSocket(id, onStatusChanged, onLocationUpdated)
    const onLocationUpdated = lastCall![2];

    // Trigger the callback with mock location
    onLocationUpdated({ lat: 30.12345, lng: 78.67890 });

    const display = await screen.findByTestId("rider-location-display");
    expect(display).toHaveTextContent("30.12345, 78.67890");
  });

  it("queries the last-known location on mount when status is OUT_FOR_DELIVERY", async () => {
    const mockOrder = {
      id: "order-delivering",
      status: "OUT_FOR_DELIVERY",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
    };

    apiGetSpy.mockImplementation((url: string) => {
      if (url.endsWith("/rider-location")) {
        return Promise.resolve({
          data: { success: true, data: { lat: "30.4600", lng: "78.0680", updatedAt: new Date().toISOString() } }
        });
      }
      return Promise.resolve({
        data: { success: true, data: mockOrder }
      });
    });

    renderComponent("order-delivering");

    expect(await screen.findByRole("heading", { name: "On the way" })).toBeInTheDocument();
    const display = await screen.findByTestId("rider-location-display");
    expect(display).toHaveTextContent("30.46000, 78.06800");
    expect(apiGetSpy).toHaveBeenCalledWith("/api/v1/orders/order-delivering/rider-location");
  });

  it("does not render rider location display when API returns null last-known location", async () => {
    const mockOrder = {
      id: "order-delivering",
      status: "OUT_FOR_DELIVERY",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
    };

    apiGetSpy.mockImplementation((url: string) => {
      if (url.endsWith("/rider-location")) {
        return Promise.resolve({
          data: { success: true, data: null }
        });
      }
      return Promise.resolve({
        data: { success: true, data: mockOrder }
      });
    });

    renderComponent("order-delivering");

    expect(await screen.findByRole("heading", { name: "On the way" })).toBeInTheDocument();
    expect(screen.queryByTestId("rider-location-display")).not.toBeInTheDocument();
    expect(screen.getByText(/waiting for rider gps updates/i)).toBeInTheDocument();
  });

  it("does not query last-known location on mount when status is PREPARING", async () => {
    const mockOrder = {
      id: "order-preparing",
      status: "PREPARING",
      createdAt: new Date(Date.now() - 600000).toISOString(),
      store: { name: "Test Bakery", phone: "1234567890" },
      items: [],
      subtotal: "100.00",
      deliveryFee: "20.00",
      total: "120.00",
      paymentMethod: "COD",
      landmarkDescription: "Near red gate",
    };

    apiGetSpy.mockResolvedValue({
      data: { success: true, data: mockOrder }
    });

    renderComponent("order-preparing");

    expect(await screen.findByText(/store is picking items/i)).toBeInTheDocument();
    expect(apiGetSpy).not.toHaveBeenCalledWith("/api/v1/orders/order-preparing/rider-location");
  });
});



