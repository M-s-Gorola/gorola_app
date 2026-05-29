import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreStockHistoryPage } from "./StoreStockHistoryPage";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

const mockProduct = {
  id: "prod-1",
  name: "Premium Apples",
  variants: [
    { id: "var-1", label: "1kg Bag", unit: "kg" },
    { id: "var-2", label: "2kg Box", unit: "kg" }
  ]
};

const mockHistory = [
  {
    id: "move-1",
    type: "REFILL",
    quantity: 10,
    stockQtyBefore: 2,
    stockQtyAfter: 12,
    note: "Restock from distributor",
    reason: null,
    createdAt: "2026-05-29T10:00:00Z",
    productVariant: {
      id: "var-1",
      label: "1kg Bag",
      unit: "kg",
      product: {
        id: "prod-1",
        name: "Premium Apples"
      }
    }
  },
  {
    id: "move-2",
    type: "ADJUSTMENT",
    quantity: 2,
    stockQtyBefore: 12,
    stockQtyAfter: 10,
    note: null,
    reason: "Wasted fruit",
    createdAt: "2026-05-29T11:00:00Z",
    productVariant: {
      id: "var-1",
      label: "1kg Bag",
      unit: "kg",
      product: {
        id: "prod-1",
        name: "Premium Apples"
      }
    }
  },
  {
    id: "move-3",
    type: "SALE",
    quantity: 1,
    stockQtyBefore: 5,
    stockQtyAfter: 4,
    note: null,
    reason: null,
    createdAt: "2026-05-29T12:00:00Z",
    productVariant: {
      id: "var-2",
      label: "2kg Box",
      unit: "kg",
      product: {
        id: "prod-1",
        name: "Premium Apples"
      }
    }
  }
];

function renderStockHistory(initialEntries: InitialEntry[] = ["/store/products/prod-1/stock-history"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/products" element={<div>Products List Page</div>} />
          <Route path="/store/products/:id/stock-history" element={<StoreStockHistoryPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreStockHistoryPage", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("renders skeletons during loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderStockHistory();

    expect(screen.getAllByTestId("history-row-skeleton")).toHaveLength(3);
  });

  it("renders empty state when there are no movements", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/products/prod-1/stock-history")) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({ data: { success: true, data: mockProduct } });
    });

    renderStockHistory();

    expect(await screen.findByText(/no movements found/i)).toBeInTheDocument();
  });

  it("renders stock history list and allows filtering by variant and type", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/products/prod-1/stock-history")) {
        return Promise.resolve({ data: { success: true, data: mockHistory } });
      }
      return Promise.resolve({ data: { success: true, data: mockProduct } });
    });

    renderStockHistory();

    // Verify layout elements and initial records
    expect(await screen.findByText("Premium Apples")).toBeInTheDocument();
    expect(screen.getByText("Restock from distributor")).toBeInTheDocument();
    expect(screen.getByText("Wasted fruit")).toBeInTheDocument();
    expect(screen.getByText("RESTOCK")).toBeInTheDocument();
    expect(screen.getByText("ADJUSTMENT")).toBeInTheDocument();
    expect(screen.getByText("SALE")).toBeInTheDocument();

    const user = userEvent.setup();

    // Filter by Variant "2kg Box"
    const variantSelect = screen.getByTestId("variant-filter");
    await user.selectOptions(variantSelect, "var-2");

    // Only Sale (move-3) should be shown, move-1 and move-2 should be hidden
    expect(screen.getByText("SALE")).toBeInTheDocument();
    expect(screen.queryByText("RESTOCK")).not.toBeInTheDocument();
    expect(screen.queryByText("ADJUSTMENT")).not.toBeInTheDocument();

    // Reset variant to All, filter by Type "Adjustment"
    await user.selectOptions(variantSelect, "ALL");
    const typeSelect = screen.getByTestId("type-filter");
    await user.selectOptions(typeSelect, "ADJUSTMENT");

    // Only adjustment should be visible
    expect(screen.getByText("ADJUSTMENT")).toBeInTheDocument();
    expect(screen.queryByText("RESTOCK")).not.toBeInTheDocument();
    expect(screen.queryByText("SALE")).not.toBeInTheDocument();
  });

  it("navigates back to products list when back button is clicked", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/products/prod-1/stock-history")) {
        return Promise.resolve({ data: { success: true, data: mockHistory } });
      }
      return Promise.resolve({ data: { success: true, data: mockProduct } });
    });

    renderStockHistory();

    const backBtn = await screen.findByTestId("history-back-button");
    const user = userEvent.setup();

    await user.click(backBtn);

    expect(await screen.findByText("Products List Page")).toBeInTheDocument();
  });
});
