import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreProductsPage } from "./StoreProductsPage";

const { getMock, deleteMock, putMock, profileMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
  profileMock: vi.fn().mockResolvedValue({
    data: {
      success: true,
      data: { storeType: "QUICK_COMMERCE" }
    }
  })
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockImplementation((url: string, ...args: unknown[]) => {
      if (url.includes("/profile")) {
        return profileMock(url, ...args);
      }
      return getMock(url, ...args);
    }),
    delete: deleteMock,
    post: vi.fn(),
    put: putMock
  }
}));

function renderStoreProducts(initialEntries: InitialEntry[] = ["/store/products"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/products" element={<StoreProductsPage />} />
          <Route path="/store/products/new" element={<div>Create Product Page</div>} />
          <Route path="/store/products/:id/edit" element={<div>Edit Product Page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreProductsPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    deleteMock.mockReset();
    putMock.mockReset();
  });

  it("renders skeletons during loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderStoreProducts();

    expect(screen.getAllByTestId("product-row-skeleton")).toHaveLength(3);
  });

  it("renders error state when api fails", async () => {
    getMock.mockRejectedValueOnce(new Error("Database Failure"));

    renderStoreProducts();

    expect(await screen.findByText(/failed to load products/i)).toBeInTheDocument();
  });

  it("renders empty state when there are no products", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 10, hasMore: false }
      }
    });

    renderStoreProducts();

    expect(await screen.findByText(/no products registered/i)).toBeInTheDocument();
  });

  it("renders products list, low stock badges, displays variants counts and handles status toggling", async () => {
    const mockProducts = [
      {
        id: "prod-1",
        name: "Premium Apples",
        description: "Fresh red apples from Shimla",
        imageUrl: "http://example.com/apples.png",
        subCategoryId: "subcat-1",
        subCategory: { id: "subcat-1", name: "Fresh Fruits" },
        isActive: true,
        variants: [
          {
            id: "var-1",
            label: "1kg Bag",
            price: 150,
            stockQty: 2, // low stock! threshold is 5
            unit: "kg",
            isActive: true,
            lowStockThreshold: 5
          }
        ]
      },
      {
        id: "prod-2",
        name: "Organic Milk",
        description: "Fresh whole cow milk",
        imageUrl: "http://example.com/milk.png",
        subCategoryId: "subcat-2",
        subCategory: { id: "subcat-2", name: "Dairy & Eggs" },
        isActive: true,
        variants: [
          {
            id: "var-2",
            label: "1 Liter",
            price: 70,
            stockQty: 25, // not low stock
            unit: "L",
            isActive: true,
            lowStockThreshold: 5
          }
        ]
      }
    ];

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockProducts,
        meta: { total: 2, page: 1, limit: 10, hasMore: false }
      }
    });

    renderStoreProducts();

    // Verify list renders
    expect(await screen.findByText("Premium Apples")).toBeInTheDocument();
    expect(screen.getByText("Organic Milk")).toBeInTheDocument();
    expect(screen.getByText("Fresh Fruits")).toBeInTheDocument();
    expect(screen.getByText("Dairy & Eggs")).toBeInTheDocument();

    // Verify low stock indicator
    expect(screen.getByTestId("low-stock-badge-prod-1")).toBeInTheDocument();
    expect(screen.getByTestId("in-stock-badge-prod-2")).toBeInTheDocument();

    // Verify active/total variant count
    expect(screen.getByTestId("variants-summary-prod-1")).toHaveTextContent("1 active out of 1");
    expect(screen.getByTestId("variants-summary-prod-2")).toHaveTextContent("1 active out of 1");

    // Verify Stock History column heading and buttons exist
    expect(screen.getByText("Stock History")).toBeInTheDocument();
    expect(screen.getByTestId("stock-history-prod-1")).toBeInTheDocument();
    expect(screen.getByTestId("stock-history-prod-2")).toBeInTheDocument();

    // Trigger status toggle (toggling prod-1 from active to inactive)
    const user = userEvent.setup();
    const toggleSwitch = screen.getByTestId("status-toggle-prod-1");
    expect(toggleSwitch).toBeInTheDocument();
    expect(toggleSwitch).toBeChecked(); // should be active initially

    // Mock API status change response
    putMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: { ...mockProducts[0], isActive: false }
      }
    });

    // Mock next refetch call returning the deactivated product in the list (since dashboard doesn't filter)
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { ...mockProducts[0], isActive: false },
          mockProducts[1]
        ],
        meta: { total: 2, page: 1, limit: 10, hasMore: false }
      }
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    // Click the toggle switch to deactivate
    await user.click(toggleSwitch);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/products/prod-1/status", { isActive: false });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "products"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "dashboard"] });
    });
  });

  it("handles search inputs by refetching data with search queries", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 10, hasMore: false }
      }
    });

    renderStoreProducts();

    const user = userEvent.setup();
    const searchInput = await screen.findByPlaceholderText(/search by product name/i);
    await user.type(searchInput, "Apple");

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(expect.stringContaining("search=Apple"));
    });
  });

  it("handles lowStock search query param on mount and toggle clicks", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 10, hasMore: false }
      }
    });

    // Render with lowStock=true query param
    renderStoreProducts(["/store/products?lowStock=true"]);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(expect.stringContaining("lowStock=true"));
    });

    const user = userEvent.setup();
    const filterBtn = await screen.findByRole("button", { name: /showing low stock only/i });
    expect(filterBtn).toBeInTheDocument();

    // Click to deactivate filter
    await user.click(filterBtn);

    await waitFor(() => {
      // should hit the api without lowStock=true
      expect(getMock).toHaveBeenLastCalledWith(expect.not.stringContaining("lowStock=true"));
    });
  });

  it("displays variants summary under the variants column", async () => {
    const mockProducts = [
      {
        id: "prod-1",
        name: "Premium Apples",
        description: "Fresh red apples from Shimla",
        imageUrl: "http://example.com/apples.png",
        subCategoryId: "subcat-1",
        subCategory: { id: "subcat-1", name: "Fresh Fruits" },
        isActive: true,
        variants: [
          {
            id: "var-1",
            label: "1kg Bag",
            price: 150,
            stockQty: 2,
            unit: "kg",
            isActive: true,
            isAvailableForBooking: false,
            lowStockThreshold: 5
          }
        ]
      }
    ];

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockProducts,
        meta: { total: 1, page: 1, limit: 10, hasMore: false }
      }
    });

    renderStoreProducts();

    // Verify variants summary renders "1 active out of 1"
    const summary = await screen.findByTestId("variants-summary-prod-1");
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent("1 active out of 1");
  });

  it("hides all inventory actions for BOOKING_COMMERCE stores", async () => {
    profileMock.mockResolvedValueOnce({
      data: { success: true, data: { storeType: "BOOKING_COMMERCE" } }
    });

    const mockProducts = [
      {
        id: "prod-1",
        name: "Premium Apples",
        description: "Fresh red apples from Shimla",
        imageUrl: "http://example.com/apples.png",
        subCategoryId: "subcat-1",
        subCategory: { id: "subcat-1", name: "Fresh Fruits" },
        isActive: true,
        variants: [
          {
            id: "var-1",
            label: "1kg Bag",
            price: 150,
            stockQty: 2,
            unit: "kg",
            isActive: true,
            lowStockThreshold: 5
          }
        ]
      }
    ];

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockProducts,
        meta: { total: 1, page: 1, limit: 10, hasMore: false }
      }
    });

    renderStoreProducts();

    // Verify product name renders
    expect(await screen.findByText("Premium Apples")).toBeInTheDocument();

    // Verify inventory actions and badges are NOT in the document
    expect(screen.queryByTestId("restock-button-var-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("adjust-stock-button-var-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("threshold-button-var-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("variant-stock-badge-var-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stock-history-prod-1")).not.toBeInTheDocument();
  });
});
