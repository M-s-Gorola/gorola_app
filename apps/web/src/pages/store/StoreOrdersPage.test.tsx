import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";

import { StoreOrdersPage } from "./StoreOrdersPage";

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    put: putMock,
    post: vi.fn()
  }
}));

function renderStoreOrders(initialEntries: InitialEntry[] = ["/store/orders"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/orders" element={<StoreOrdersPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreOrdersPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();

    useAuthStore.getState().setStoreOwnerSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-user-id",
      storeId: "mock-store-id"
    });

    // Default mock implementations to prevent test breakages on auxiliary queries
    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({ data: { success: true, data: { storeType: "QUICK_COMMERCE" } } });
      }
      if (url.includes("/offers")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return new Promise(() => {}); // remains pending
    });
  });

  it("renders skeletons during loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderStoreOrders();

    expect(screen.getAllByTestId("order-card-skeleton")).toHaveLength(3);
  });

  it("renders error message when API call fails", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({ data: { success: true, data: { storeType: "QUICK_COMMERCE" } } });
      }
      if (url.includes("/offers")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url.includes("/orders")) {
        return Promise.reject(new Error("Network Error"));
      }
      return Promise.reject(new Error("Not found"));
    });

    renderStoreOrders();

    expect(await screen.findByText(/failed to retrieve orders/i)).toBeInTheDocument();
  });

  it("renders orders list, filter tabs, elapsed timers, and detail modals on success", async () => {
    const mockOrdersData = {
      success: true,
      data: [
        {
          id: "order-1",
          userId: "buyer-123",
          storeId: "store-456",
          status: "PLACED",
          subtotal: 150.0,
          deliveryFee: 30.0,
          total: 160.0,
          paymentMethod: "COD",
          landmarkDescription: "Near park",
          flatRoom: "Room 404",
          addressLabel: "Office",
          createdAt: new Date(Date.now() - 300000).toISOString(), // 5m ago
          buyerMaskedPhone: "*********3210",
          items: [
            {
              id: "item-1",
              productName: "Organic Bananas",
              variantLabel: "Pack of 6",
              price: 150.0,
              quantity: 1
            }
          ],
          statusHistory: [
            {
              id: "hist-1",
              status: "PLACED",
              changedAt: new Date(Date.now() - 300000).toISOString(),
              changedBy: "BUYER"
            }
          ]
        }
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({ data: { success: true, data: { storeType: "QUICK_COMMERCE" } } });
      }
      if (url.includes("/offers")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: "offer-1",
                title: "Inaugural Store Offer",
                discountType: "FLAT",
                discountValue: 20,
                startsAt: new Date(Date.now() - 1000000).toISOString(),
                endsAt: new Date(Date.now() + 1000000).toISOString(),
                isActive: true
              }
            ]
          }
        });
      }
      if (url.includes("/orders")) {
        return Promise.resolve({ data: mockOrdersData });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderStoreOrders();

    // Verify filter tabs are rendered
    expect(screen.getByText("All Orders")).toBeInTheDocument();
    expect(screen.getByText("PLACED")).toBeInTheDocument();
    expect(screen.getByText("PREPARING")).toBeInTheDocument();

    // Verify order cards are rendered
    expect(await screen.findByTestId("order-card-order-1")).toBeInTheDocument();
    expect(screen.getByText("#ORDER-1")).toBeInTheDocument();
    expect(screen.getByText("₹160.00")).toBeInTheDocument();
    expect(screen.getByText("Organic Bananas (x1)")).toBeInTheDocument();
    expect(screen.getByText("5m ago")).toBeInTheDocument();

    // Click order card to open detailed modal dialog
    fireEvent.click(screen.getByTestId("order-card-order-1"));

    // Verify Modal Dialog rendered
    expect(await screen.findByTestId("order-details-modal")).toBeInTheDocument();
    expect(screen.getByText("*********3210")).toBeInTheDocument();
    
    // Verify applied discount displays in modal
    expect(screen.getByTestId("store-order-discount")).toBeInTheDocument();
    expect(screen.getByText("Discount (Inaugural Store Offer)")).toBeInTheDocument();
    expect(screen.getByText("-₹20.00")).toBeInTheDocument();
    
    // Verify complete delivery address displays inside detailed modal
    expect(screen.queryByText(/\[Office\]/)).not.toBeInTheDocument();
    expect(screen.getByText(/Room 404, Near park/)).toBeInTheDocument();
    
    expect(screen.getByText(/By BUYER at/i)).toBeInTheDocument();
    expect(screen.getByText("Pack of 6")).toBeInTheDocument();

    // Action button to transition status: PLACED -> PREPARING
    const prepBtn = screen.getByRole("button", { name: /mark preparing/i });
    expect(prepBtn).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel order/i });
    expect(cancelBtn).toBeInTheDocument();

    // Simulate clicking "Mark Preparing" action
    const firstOrder = mockOrdersData.data[0]!;
    const mockUpdatedOrder = {
      success: true,
      data: {
        ...firstOrder,
        status: "PREPARING",
        statusHistory: [
          ...firstOrder.statusHistory,
          {
            id: "hist-2",
            status: "PREPARING",
            changedAt: new Date().toISOString(),
            changedBy: "STORE_OWNER"
          }
        ]
      }
    };

    putMock.mockResolvedValueOnce({ data: mockUpdatedOrder });
    fireEvent.click(prepBtn);

    // Verify put endpoint was hit with correct payload
    await vi.waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/orders/order-1/status", {
        status: "PREPARING"
      });
    });
  });
});
