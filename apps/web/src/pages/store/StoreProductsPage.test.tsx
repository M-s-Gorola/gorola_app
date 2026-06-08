import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreProductsPage } from "./StoreProductsPage";

const { getMock, deleteMock, putMock, profileMock, postMock, xlsxMockRead, xlsxMockSheetToJson, xlsxMockJsonToSheet, xlsxMockAoaToSheet } = vi.hoisted(() => ({
  getMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
  postMock: vi.fn(),
  profileMock: vi.fn().mockResolvedValue({
    data: {
      success: true,
      data: { storeType: "QUICK_COMMERCE" }
    }
  }),
  xlsxMockRead: vi.fn().mockReturnValue({
    SheetNames: ["Sheet1"],
    Sheets: { Sheet1: {} }
  }),
  xlsxMockSheetToJson: vi.fn().mockReturnValue([]),
  xlsxMockJsonToSheet: vi.fn().mockReturnValue({}),
  xlsxMockAoaToSheet: vi.fn().mockReturnValue({})
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
    post: postMock,
    put: putMock
  }
}));

vi.mock("xlsx", () => ({
  read: xlsxMockRead,
  utils: {
    sheet_to_json: xlsxMockSheetToJson,
    json_to_sheet: xlsxMockJsonToSheet,
    book_new: vi.fn().mockReturnValue({}),
    book_append_sheet: vi.fn(),
    aoa_to_sheet: xlsxMockAoaToSheet
  },
  write: vi.fn().mockReturnValue(new Uint8Array())
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
    postMock.mockReset();
    xlsxMockSheetToJson.mockReset();
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

  it("hides Stock Status column and uses Services terminology for BOOKING_COMMERCE stores", async () => {
    profileMock.mockResolvedValueOnce({
      data: { success: true, data: { storeType: "BOOKING_COMMERCE" } }
    });

    const mockProducts = [
      {
        id: "prod-1",
        name: "Acme Consultation",
        description: "Standard business consulting",
        imageUrl: "http://example.com/consult.png",
        subCategoryId: "subcat-1",
        subCategory: { id: "subcat-1", name: "Consulting" },
        isActive: true,
        variants: [
          {
            id: "var-1",
            label: "1 Hour Session",
            price: 500,
            stockQty: 0,
            unit: "session",
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

    // Verify title and page texts are normalized to "Services"
    expect(await screen.findByText("Store Services")).toBeInTheDocument();
    expect(screen.getByText(/Manage your store catalog, track variants, and pricing/i)).toBeInTheDocument();
    expect(screen.getByText("Add Service")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search by service name/i)).toBeInTheDocument();

    // Verify Stock Status column header is NOT rendered
    expect(screen.queryByText("Stock Status")).not.toBeInTheDocument();
    // Verify individual product stock badges are NOT rendered
    expect(screen.queryByTestId("low-stock-badge-prod-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("in-stock-badge-prod-1")).not.toBeInTheDocument();

    // Verify Low Stock filter button is NOT rendered
    expect(screen.queryByRole("button", { name: /Filter Low Stock/i })).not.toBeInTheDocument();
  });

  it("renders correct terminology in empty state for BOOKING_COMMERCE stores", async () => {
    profileMock.mockResolvedValueOnce({
      data: { success: true, data: { storeType: "BOOKING_COMMERCE" } }
    });

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 10, hasMore: false }
      }
    });

    renderStoreProducts();

    expect(await screen.findByText("No services registered")).toBeInTheDocument();
    expect(screen.getByText(/Start expanding your catalog by registering your first service variants today/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Service" })).toBeInTheDocument();
  });

  describe("Bulk Import Products", () => {
    beforeEach(() => {
      postMock.mockReset();

      // Mock profile as QUICK_COMMERCE by default
      profileMock.mockResolvedValue({
        data: { success: true, data: { storeType: "QUICK_COMMERCE" } }
      });

      // Mock products fetch
      getMock.mockResolvedValue({
        data: {
          success: true,
          data: [],
          meta: { total: 0, page: 1, limit: 10, hasMore: false }
        }
      });
    });

    it("renders Bulk Import button for QUICK_COMMERCE stores", async () => {
      renderStoreProducts();
      expect(await screen.findByTestId("bulk-import-products-btn")).toBeInTheDocument();
    });

    it("opens bulk import modal on button click", async () => {
      renderStoreProducts();
      const user = userEvent.setup();

      const btn = await screen.findByTestId("bulk-import-products-btn");
      await user.click(btn);

      expect(screen.getByTestId("bulk-import-products-modal")).toBeInTheDocument();
      expect(screen.getByText(/Download Sample/i)).toBeInTheDocument();
      expect(screen.getByTestId("bulk-products-file-input")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
    });

    it("handles validation success flow", async () => {
      renderStoreProducts();
      const user = userEvent.setup();

      const btn = await screen.findByTestId("bulk-import-products-btn");
      await user.click(btn);

      const fileInput = screen.getByTestId("bulk-products-file-input");
      const file = new File(["dummy content"], "products.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      xlsxMockSheetToJson.mockReturnValueOnce([
        {
          "Product Name": "Amul Milk",
          "Sub-Category Name": "Full Cream Milk",
          "Description": "Fresh",
          "Image URL": "http://example.com/milk.png",
          "Variant Label": "500ml",
          "Price": 35,
          "Stock Qty": 100,
          "Unit": "packet"
        }
      ]);

      await user.upload(fileInput, file);

      const validateBtn = screen.getByRole("button", { name: "Validate" });
      await waitFor(() => expect(validateBtn).toBeEnabled());

      postMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            valid: true,
            conflicts: [],
            totalRows: 1,
            totalVariantRows: 1
          }
        }
      });

      await user.click(validateBtn);

      expect(await screen.findByTestId("bulk-validation-success")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm & Import" })).toBeInTheDocument();

      // Trigger confirm
      postMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            inserted: 1,
            skipped: 0
          }
        }
      });

      await user.click(screen.getByRole("button", { name: "Confirm & Import" }));
      await waitFor(() => {
        expect(postMock).toHaveBeenLastCalledWith("/api/v1/store/bulk/products/confirm?mode=strict", expect.any(Object));
      });
    });

    it("handles validation failure flow with conflicts display", async () => {
      renderStoreProducts();
      const user = userEvent.setup();

      const btn = await screen.findByTestId("bulk-import-products-btn");
      await user.click(btn);

      const fileInput = screen.getByTestId("bulk-products-file-input");
      const file = new File(["dummy content"], "products.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      xlsxMockSheetToJson.mockReturnValueOnce([
        { "Product Name": "Amul Milk", "Variant Label": "500ml", "New Stock Qty": 100 }
      ]);

      await user.upload(fileInput, file);

      const validateBtn = screen.getByRole("button", { name: "Validate" });
      
      // Mock validation failure response
      postMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            valid: false,
            conflicts: [
              { row: 1, type: "PRODUCT_NAME_EXISTS", productName: "Amul Milk" },
              { row: 2, type: "SUBCATEGORY_NOT_FOUND", subCategoryName: "NonExistent" },
              { row: 3, type: "COMMERCE_TYPE_MISMATCH", subCategoryName: "All Repairs", commerceType: "BOOKING_COMMERCE" },
              { row: 4, type: "DUPLICATE_VARIANT_LABEL", label: "500ml" }
            ],
            totalRows: 4,
            totalVariantRows: 4
          }
        }
      });

      await user.click(validateBtn);

      expect(await screen.findByTestId("bulk-conflict-table")).toBeInTheDocument();
      expect(screen.getByText(/^Row 1$/i)).toBeInTheDocument();
      expect(screen.getByText(/Product 'Amul Milk' already exists in your store./i)).toBeInTheDocument();
      expect(screen.getByText(/^Row 2$/i)).toBeInTheDocument();
      expect(screen.getByText(/Sub-category 'NonExistent' was not found in the system./i)).toBeInTheDocument();
      expect(screen.getByText(/^Row 3$/i)).toBeInTheDocument();
      expect(screen.getByText(/Sub-category 'All Repairs' is for Booking Commerce and cannot be added to this store./i)).toBeInTheDocument();
      expect(screen.getByText(/^Row 4$/i)).toBeInTheDocument();
      expect(screen.getByText(/Duplicate variant label '500ml' found in row 4./i)).toBeInTheDocument();

      const skipBtn = screen.getByRole("button", { name: /Skip conflicts/i });
      expect(skipBtn).toBeInTheDocument();

      postMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: { inserted: 1, skipped: 3 }
        }
      });

      await user.click(skipBtn);
      await waitFor(() => {
        expect(postMock).toHaveBeenLastCalledWith("/api/v1/store/bulk/products/confirm?mode=skip", expect.any(Object));
      });
    });
  });

  describe("Bulk Restock Products", () => {
    it("opens bulk restock modal on button click", async () => {
      renderStoreProducts();
      const user = userEvent.setup();

      const btn = await screen.findByTestId("bulk-restock-products-btn");
      await user.click(btn);

      expect(screen.getByTestId("bulk-restock-products-modal")).toBeInTheDocument();
      expect(screen.getByText(/Download Sample/i)).toBeInTheDocument();
      expect(screen.getByTestId("bulk-restock-file-input")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
    });

    it("handles restock validation success flow", async () => {
      renderStoreProducts();
      const user = userEvent.setup();

      const btn = await screen.findByTestId("bulk-restock-products-btn");
      await user.click(btn);

      const fileInput = screen.getByTestId("bulk-restock-file-input");
      const file = new File(["dummy content"], "restock.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      xlsxMockSheetToJson.mockReturnValueOnce([
        { "Product Name": "Amul Milk", "Variant Label": "500ml", "New Stock Qty": 120 }
      ]);

      await user.upload(fileInput, file);

      const validateBtn = screen.getByRole("button", { name: "Validate" });
      await waitFor(() => expect(validateBtn).toBeEnabled());

      postMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            valid: true,
            conflicts: [],
            totalRows: 1
          }
        }
      });

      await user.click(validateBtn);

      expect(await screen.findByTestId("bulk-restock-validation-success")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm & Restock" })).toBeInTheDocument();

      // Trigger confirm
      postMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            updated: 1,
            skipped: 0
          }
        }
      });

      await user.click(screen.getByRole("button", { name: "Confirm & Restock" }));
      await waitFor(() => {
        expect(postMock).toHaveBeenLastCalledWith("/api/v1/store/bulk/restock/confirm?mode=strict", expect.any(Object));
      });
    });

    it("handles restock validation failure flow with conflicts display", async () => {
      renderStoreProducts();
      const user = userEvent.setup();

      const btn = await screen.findByTestId("bulk-restock-products-btn");
      await user.click(btn);

      const fileInput = screen.getByTestId("bulk-restock-file-input");
      const file = new File(["dummy content"], "restock.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      xlsxMockSheetToJson.mockReturnValueOnce([
        { "Product Name": "Amul Milk", "Variant Label": "500ml", "New Stock Qty": 120 }
      ]);

      await user.upload(fileInput, file);

      const validateBtn = screen.getByRole("button", { name: "Validate" });

      // Mock validation failure response
      postMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            valid: false,
            conflicts: [
              { row: 1, type: "PRODUCT_NOT_FOUND", productName: "Amul Milk" },
              { row: 2, type: "AMBIGUOUS_PRODUCT_NAME", productName: "Cheese" },
              { row: 3, type: "VARIANT_NOT_FOUND", productName: "Butter", variantLabel: "500g" }
            ],
            totalRows: 3
          }
        }
      });

      await user.click(validateBtn);

      expect(await screen.findByTestId("bulk-restock-conflict-table")).toBeInTheDocument();
      expect(screen.getByText(/^Row 1$/i)).toBeInTheDocument();
      expect(screen.getByText(/Product 'Amul Milk' was not found in your store./i)).toBeInTheDocument();
      expect(screen.getByText(/^Row 2$/i)).toBeInTheDocument();
      expect(screen.getByText(/Multiple products share the name 'Cheese'. Match is ambiguous./i)).toBeInTheDocument();
      expect(screen.getByText(/^Row 3$/i)).toBeInTheDocument();
      expect(screen.getByText(/Variant '500g' was not found under product 'Butter'./i)).toBeInTheDocument();

      const skipBtn = screen.getByRole("button", { name: /Skip conflicts/i });
      expect(skipBtn).toBeInTheDocument();

      postMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: { updated: 1, skipped: 2 }
        }
      });

      await user.click(skipBtn);
      await waitFor(() => {
        expect(postMock).toHaveBeenLastCalledWith("/api/v1/store/bulk/restock/confirm?mode=skip", expect.any(Object));
      });
    });
  });
});

