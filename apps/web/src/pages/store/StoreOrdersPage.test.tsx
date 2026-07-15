import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText("Placed")).toBeInTheDocument();
    expect(screen.getByText("Preparing")).toBeInTheDocument();

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
    const discountToggle = screen.getByTestId("store-order-discount-toggle");
    expect(discountToggle).toBeInTheDocument();
    expect(discountToggle.getAttribute("aria-expanded")).toBe("false");
    
    // Expand the discount breakdown
    fireEvent.click(discountToggle);
    expect(discountToggle.getAttribute("aria-expanded")).toBe("true");
    const discountContainer = screen.getByTestId("store-order-discount");
    expect(within(discountContainer).getByText(/• Discount \(Inaugural Store Offer\)/)).toBeInTheDocument();
    expect(within(discountContainer).getAllByText("-₹20.00").length).toBeGreaterThanOrEqual(1);
    
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

    // Verify modal is shown and put endpoint is NOT immediately called
    expect(screen.getByText(/Are you sure you want to mark this order/i)).toBeInTheDocument();
    expect(putMock).not.toHaveBeenCalled();

    // Click confirm inside confirmation dialog
    const confirmButton = screen.getByRole("button", { name: /^Confirm$/i });
    fireEvent.click(confirmButton);

    // Verify put endpoint was hit with correct payload
    await vi.waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/orders/order-1/status", {
        status: "PREPARING"
      });
    });
  });

  it("renders a collapsible discount breakdown in the order detail modal when toggled", async () => {
    const mockOrdersData = {
      success: true,
      data: [
        {
          id: "order-2",
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
          createdAt: new Date().toISOString(),
          buyerMaskedPhone: "*********3210",
          items: [
            {
              id: "item-2",
              productName: "Organic Bananas",
              variantLabel: "Pack of 6",
              price: 150.0,
              quantity: 1
            }
          ],
          statusHistory: [
            {
              id: "hist-2",
              status: "PLACED",
              changedAt: new Date().toISOString(),
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

    await screen.findByTestId("order-card-order-2");
    fireEvent.click(screen.getByTestId("order-card-order-2"));

    expect(await screen.findByTestId("order-details-modal")).toBeInTheDocument();
    
    // Check collapsible discount summary row is shown
    expect(screen.getByTestId("store-order-discount")).toBeInTheDocument();
    
    const toggle = screen.getByTestId("store-order-discount-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    // List is hidden by default
    expect(screen.queryByTestId("store-order-discount-list")).not.toBeInTheDocument();

    // Toggle expand
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    const discountList = screen.getByTestId("store-order-discount-list");
    expect(discountList).toBeInTheDocument();
    expect(within(discountList).getByText(/• Discount \(Inaugural Store Offer\)/)).toBeInTheDocument();
    expect(within(discountList).getByText("-₹20.00")).toBeInTheDocument();

    // Toggle collapse
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("store-order-discount-list")).not.toBeInTheDocument();
  });

  it("locks background body scroll when detailed order modal is open", async () => {
    const mockOrdersData = {
      success: true,
      data: [
        {
          id: "order-3",
          userId: "buyer-123",
          storeId: "store-456",
          status: "PLACED",
          subtotal: 150.0,
          deliveryFee: 30.0,
          total: 180.0,
          paymentMethod: "COD",
          landmarkDescription: "Near park",
          flatRoom: "Room 404",
          addressLabel: "Office",
          createdAt: new Date().toISOString(),
          buyerMaskedPhone: "*********3210",
          items: [
            {
              id: "item-3",
              productName: "Organic Bananas",
              variantLabel: "Pack of 6",
              price: 150.0,
              quantity: 1
            }
          ],
          statusHistory: [
            {
              id: "hist-3",
              status: "PLACED",
              changedAt: new Date().toISOString(),
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
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url.includes("/orders")) {
        return Promise.resolve({ data: mockOrdersData });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderStoreOrders();

    await screen.findByTestId("order-card-order-3");
    
    // Before opening, body overflow should be empty
    expect(document.body.style.overflow).toBe("");

    // Open modal
    fireEvent.click(screen.getByTestId("order-card-order-3"));
    expect(await screen.findByTestId("order-details-modal")).toBeInTheDocument();

    // Assert scroll locked
    expect(document.body.style.overflow).toBe("hidden");

    // Close modal
    fireEvent.click(screen.getByLabelText("Close modal"));
    expect(screen.queryByTestId("order-details-modal")).not.toBeInTheDocument();

    // Assert scroll lock is released
    expect(document.body.style.overflow).toBe("");
  });

  it("renders a date filter dropdown and triggers API queries on selection", async () => {
    const mockOrdersData = {
      success: true,
      data: [],
      meta: { total: 0, page: 1, limit: 10, hasMore: false }
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({ data: { success: true, data: { storeType: "QUICK_COMMERCE" } } });
      }
      if (url.includes("/offers")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url.includes("/orders")) {
        return Promise.resolve({ data: mockOrdersData });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderStoreOrders();

    // Verify date filter is rendered
    const dateFilter = await screen.findByTestId("order-date-filter");
    expect(dateFilter).toBeInTheDocument();
    expect(dateFilter).toHaveValue("ALL");

    // Change to TODAY
    fireEvent.change(dateFilter, { target: { value: "TODAY" } });
    expect(dateFilter).toHaveValue("TODAY");
    expect(getMock).toHaveBeenCalledWith(expect.stringContaining("dateFilter=TODAY"));

    // Change to CUSTOM -> should show custom inputs
    fireEvent.change(dateFilter, { target: { value: "CUSTOM" } });
    expect(dateFilter).toHaveValue("CUSTOM");
    expect(screen.getByTestId("date-from-input")).toBeInTheDocument();
    expect(screen.getByTestId("date-to-input")).toBeInTheDocument();

    // Input custom dates
    const fromInput = screen.getByTestId("date-from-input");
    const toInput = screen.getByTestId("date-to-input");
    fireEvent.change(fromInput, { target: { value: "2026-06-10" } });
    fireEvent.change(toInput, { target: { value: "2026-06-11" } });

    expect(getMock).toHaveBeenCalledWith(expect.stringContaining("dateFilter=CUSTOM"));
    expect(getMock).toHaveBeenCalledWith(expect.stringContaining("customFrom=2026-06-10"));
    expect(getMock).toHaveBeenCalledWith(expect.stringContaining("customTo=2026-06-11"));
  });

  it("initializes dateFilter state automatically from search parameters", async () => {
    const mockOrdersData = {
      success: true,
      data: [],
      meta: { total: 0, page: 1, limit: 10, hasMore: false }
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({ data: { success: true, data: { storeType: "QUICK_COMMERCE" } } });
      }
      if (url.includes("/offers")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url.includes("/orders")) {
        return Promise.resolve({ data: mockOrdersData });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderStoreOrders(["/store/orders?dateFilter=TODAY"]);

    const dateFilter = await screen.findByTestId("order-date-filter");
    expect(dateFilter).toHaveValue("TODAY");
  });

  it("restricts status transitions and disables dispatch button if no rider is assigned", async () => {
    const mockOrdersData = {
      success: true,
      data: [
        {
          id: "order-no-rider",
          userId: "buyer-123",
          storeId: "store-456",
          status: "PREPARING",
          subtotal: 150.0,
          deliveryFee: 30.0,
          total: 180.0,
          paymentMethod: "COD",
          landmarkDescription: "Near park",
          flatRoom: "Room 404",
          addressLabel: "Office",
          createdAt: new Date(Date.now() - 300000).toISOString(),
          buyerMaskedPhone: "*********3210",
          riderId: null,
          deliveryLat: 12.9715987,
          deliveryLng: 77.5945627,
          items: [],
          statusHistory: []
        },
        {
          id: "order-with-rider",
          userId: "buyer-123",
          storeId: "store-456",
          status: "OUT_FOR_DELIVERY",
          subtotal: 150.0,
          deliveryFee: 30.0,
          total: 180.0,
          paymentMethod: "COD",
          landmarkDescription: "Near park",
          flatRoom: "Room 404",
          addressLabel: "Office",
          createdAt: new Date(Date.now() - 300000).toISOString(),
          buyerMaskedPhone: "*********3210",
          riderId: "rider-1",
          deliveryLat: 12.9715987,
          deliveryLng: 77.5945627,
          items: [],
          statusHistory: []
        }
      ],
      meta: { total: 2, page: 1, limit: 10, hasMore: false }
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({ data: { success: true, data: { storeType: "QUICK_COMMERCE" } } });
      }
      if (url.includes("/offers")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url.includes("/orders")) {
        return Promise.resolve({ data: mockOrdersData });
      }
      if (url.includes("/rider-location")) {
        return Promise.resolve({ data: { success: true, data: { lat: "12.9716", lng: "77.5946" } } });
      }
      return Promise.reject(new Error("Not found"));
    });

    renderStoreOrders();

    // 1. Check order without rider (status PREPARING)
    const cardNoRider = await screen.findByTestId("order-card-order-no-rider");
    fireEvent.click(cardNoRider);

    expect(await screen.findByTestId("order-details-modal")).toBeInTheDocument();
    
    // The "Dispatch Order" button should be disabled
    const dispatchBtn = screen.getByRole("button", { name: /dispatch/i });
    expect(dispatchBtn).toBeDisabled();
    expect(dispatchBtn).toHaveTextContent(/Assign Rider First/i);

    // Close modal
    fireEvent.click(screen.getByLabelText("Close modal"));

    // 2. Check order with rider (status OUT_FOR_DELIVERY)
    const cardWithRider = await screen.findByTestId("order-card-order-with-rider");
    fireEvent.click(cardWithRider);

    const modal = await screen.findByTestId("order-details-modal");
    expect(modal).toBeInTheDocument();
    
    // Delivered button should NOT be present (since Store Owners cannot deliver)
    const deliveredBtn = within(modal).queryByRole("button", { name: /delivered/i });
    expect(deliveredBtn).not.toBeInTheDocument();
  });

  it("formats status transition log for rider order acceptance and extracts rider name from note", async () => {
    const mockOrdersData = {
      success: true,
      data: [
        {
          id: "order-test-log",
          userId: "buyer-123",
          storeId: "store-456",
          status: "PREPARING",
          subtotal: 100.0,
          deliveryFee: 10.0,
          total: 110.0,
          paymentMethod: "COD",
          landmarkDescription: "Clock Tower",
          createdAt: new Date().toISOString(),
          buyerMaskedPhone: "*********3210",
          items: [{ id: "item-1", productName: "Apple", variantLabel: "1kg", price: 100.0, quantity: 1 }],
          statusHistory: [
            {
              id: "hist-1",
              status: "PLACED",
              changedAt: new Date().toISOString(),
              changedBy: "BUYER"
            },
            {
              id: "hist-2",
              status: "PREPARING",
              changedAt: new Date().toISOString(),
              changedBy: "rider:rider-123",
              note: "Order accepted by rider: Hillside Rider"
            }
          ]
        }
      ],
      meta: { total: 1 }
    };

    getMock.mockResolvedValue({ data: mockOrdersData });

    renderStoreOrders();

    // Click the card to open modal
    const card = await screen.findByTestId("order-card-order-test-log");
    fireEvent.click(card);

    // Verify detail modal is open
    expect(await screen.findByTestId("order-details-modal")).toBeInTheDocument();

    // Verify timeline formatting:
    // It should render "Order Accepted" instead of "Preparing"
    expect(screen.getByText("Order Accepted")).toBeInTheDocument();
    
    // It should format "rider:rider-123" using the rider's name "Hillside Rider"
    expect(screen.getByText(/By Hillside Rider at/i)).toBeInTheDocument();
  });
});
