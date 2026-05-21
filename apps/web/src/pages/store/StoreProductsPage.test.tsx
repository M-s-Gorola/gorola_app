import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreProductsPage } from "./StoreProductsPage";

const { getMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
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
    expect(screen.getAllByText("1 variant (1 active)")).toHaveLength(2);

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

    // Click the toggle switch to deactivate
    await user.click(toggleSwitch);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/products/prod-1/status", { isActive: false });
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
});
