import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreProductFormPage } from "./StoreProductFormPage";

const { getMock, postMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    put: putMock
  }
}));

function renderProductForm(initialEntries: InitialEntry[] = ["/store/products/new"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/products" element={<div>Products Grid</div>} />
          <Route path="/store/products/new" element={<StoreProductFormPage />} />
          <Route path="/store/products/:id/edit" element={<StoreProductFormPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const mockCategories = [
  {
    id: "cat-1",
    name: "Fruits",
    subCategories: [
      { id: "subcat-1", name: "Fresh Apples" },
      { id: "subcat-2", name: "Citrus Fruits" }
    ]
  }
];

describe("StoreProductFormPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();

    // Default categories endpoint response
    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/store/categories") {
        return Promise.resolve({
          data: { success: true, data: mockCategories }
        });
      }
      return Promise.reject(new Error(`Not Found: ${url}`));
    });
  });

  it("renders form fields and performs validations", async () => {
    renderProductForm(["/store/products/new"]);

    expect(await screen.findByLabelText(/product name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sub-category selection/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/catalog description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unique label/i)).toBeInTheDocument();

    const user = userEvent.setup();
    const saveBtn = screen.getByRole("button", { name: /create product/i });
    await user.click(saveBtn);

    // Verify validation errors
    expect(await screen.findByText(/product name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/sub-category is required/i)).toBeInTheDocument();
  });

  it("prevents submitting duplicate variant labels (DECISION-039)", async () => {
    renderProductForm(["/store/products/new"]);

    const user = userEvent.setup();

    // Fill general product details
    const nameInput = await screen.findByLabelText(/product name/i);
    await user.type(nameInput, "Unique Labels Test");
    const subcatSelect = screen.getByLabelText(/sub-category selection/i);
    await user.selectOptions(subcatSelect, "subcat-1");

    // Add another variant
    const addVariantBtn = screen.getByRole("button", { name: /add variant/i });
    await user.click(addVariantBtn);

    // Enter details for Variant 1
    const labels = screen.getAllByLabelText(/unique label/i);
    const units = screen.getAllByLabelText(/standard unit/i);
    const prices = screen.getAllByLabelText(/price/i);

    expect(labels).toHaveLength(2);

    await user.type(labels[0]!, "Pack of 6");
    await user.type(units[0]!, "pieces");
    await user.type(prices[0]!, "100");

    // Enter duplicate label for Variant 2
    await user.type(labels[1]!, "Pack of 6");
    await user.type(units[1]!, "pieces");
    await user.type(prices[1]!, "150");

    const saveBtn = screen.getByRole("button", { name: /create product/i });
    await user.click(saveBtn);

    // Verify duplicate validation trigger
    expect(await screen.findByText(/variant labels must be unique/i)).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("submits correct payload on creation", async () => {
    postMock.mockResolvedValueOnce({ data: { success: true } });

    renderProductForm(["/store/products/new"]);

    const user = userEvent.setup();

    // Fill form
    const nameInput = await screen.findByLabelText(/product name/i);
    await user.type(nameInput, "Premium Oranges");
    const subcatSelect = screen.getByLabelText(/sub-category selection/i);
    await user.selectOptions(subcatSelect, "subcat-2");
    const descTextarea = screen.getByLabelText(/catalog description/i);
    await user.type(descTextarea, "Fresh oranges direct from Nagpur");

    // Fill Variant 1
    const labelInput = screen.getByLabelText(/unique label/i);
    await user.type(labelInput, "1kg Box");
    const unitInput = screen.getByLabelText(/standard unit/i);
    await user.clear(unitInput);
    await user.type(unitInput, "kg");
    const priceInput = screen.getByLabelText(/price/i);
    await user.type(priceInput, "120.50");
    const stockInput = screen.getByLabelText(/stock quantity/i);
    await user.type(stockInput, "45");

    const saveBtn = screen.getByRole("button", { name: /create product/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/store/products", {
        name: "Premium Oranges",
        subCategoryId: "subcat-2",
        description: "Fresh oranges direct from Nagpur",
        imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300",
        variants: [
          {
            label: "1kg Box",
            price: 120.5,
            stockQty: 45,
            unit: "kg",
            lowStockThreshold: undefined
          }
        ]
      });
    });
  });

  it("submits correct metadata and variant updates in edit mode", async () => {
    const mockProductDetail = {
      success: true,
      data: {
        id: "prod-abc",
        name: "Old Apple Name",
        description: "Old description",
        imageUrl: "http://example.com/old.png",
        subCategoryId: "subcat-1",
        variants: [
          {
            id: "var-123",
            label: "1kg Box",
            price: 140.0,
            stockQty: 10,
            unit: "kg",
            lowStockThreshold: 5
          }
        ]
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/store/categories") {
        return Promise.resolve({
          data: { success: true, data: mockCategories }
        });
      }
      if (url === "/api/v1/store/products/prod-abc") {
        return Promise.resolve({
          data: mockProductDetail
        });
      }
      return Promise.reject(new Error(`Not Found: ${url}`));
    });

    putMock.mockResolvedValue({ data: { success: true } });

    renderProductForm(["/store/products/prod-abc/edit"]);

    // Verify fields populated
    const nameInput = await screen.findByLabelText(/product name/i);
    expect(nameInput).toHaveValue("Old Apple Name");

    const user = userEvent.setup();

    // Modify product properties
    await user.clear(nameInput);
    await user.type(nameInput, "New Apple Name");

    // Modify variant price
    const priceInput = screen.getByLabelText(/price/i);
    await user.clear(priceInput);
    await user.type(priceInput, "160.00");

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);

    await waitFor(() => {
      // Expect metadata PUT call
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/products/prod-abc", {
        name: "New Apple Name",
        subCategoryId: "subcat-1",
        description: "Old description",
        imageUrl: "http://example.com/old.png"
      });

      // Expect variant PUT call
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/products/prod-abc/variants/var-123", {
        label: "1kg Box",
        price: 160.0,
        stockQty: 10,
        unit: "kg",
        lowStockThreshold: 5,
        isActive: true
      });
    });
  });

  it("handles active/inactive toggles and newly added variants in edit mode", async () => {
    const mockProductDetail = {
      success: true,
      data: {
        id: "prod-xyz",
        name: "Original Milk",
        description: "Fresh milk",
        imageUrl: "http://example.com/milk.png",
        subCategoryId: "subcat-1",
        variants: [
          {
            id: "var-1",
            label: "500ml",
            price: 30.0,
            stockQty: 20,
            unit: "packet",
            lowStockThreshold: 5,
            isActive: true
          }
        ]
      }
    };

    getMock.mockImplementation((url: string) => {
      if (url === "/api/v1/store/categories") {
        return Promise.resolve({ data: { success: true, data: mockCategories } });
      }
      if (url === "/api/v1/store/products/prod-xyz") {
        return Promise.resolve({ data: mockProductDetail });
      }
      return Promise.reject(new Error(`Not Found: ${url}`));
    });

    putMock.mockResolvedValue({ data: { success: true } });
    postMock.mockResolvedValue({ data: { success: true } });

    renderProductForm(["/store/products/prod-xyz/edit"]);

    // Verify page renders details
    const nameInput = await screen.findByLabelText(/product name/i);
    expect(nameInput).toHaveValue("Original Milk");

    // The variant toggle switch is rendered for pre-existing variants
    const toggleLabel = screen.getByLabelText(/active status/i);
    expect(toggleLabel).toBeInTheDocument();
    expect(toggleLabel).toBeChecked(); // should be checked by default since isActive is true

    const user = userEvent.setup();

    // Toggle variant to inactive
    await user.click(toggleLabel);
    expect(toggleLabel).not.toBeChecked();

    // Variant row card should get deactivation styling class
    const variantCard = toggleLabel.closest("[data-testid='variant-card']");
    expect(variantCard).toHaveClass("opacity-60");

    // Add a new brand new variant
    const addVariantBtn = screen.getByRole("button", { name: /add variant/i });
    await user.click(addVariantBtn);

    // Enter details for new Variant 2
    const labels = screen.getAllByLabelText(/unique label/i);
    const units = screen.getAllByLabelText(/standard unit/i);
    const prices = screen.getAllByLabelText(/price/i);
    const stocks = screen.getAllByLabelText(/stock quantity/i);

    expect(labels).toHaveLength(2); // original plus the new one
    await user.type(labels[1]!, "1L Bottle");
    await user.clear(units[1]!);
    await user.type(units[1]!, "bottle");
    await user.type(prices[1]!, "55");
    await user.type(stocks[1]!, "40");

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);

    await waitFor(() => {
      // Expect product metadata PUT call
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/products/prod-xyz", {
        name: "Original Milk",
        subCategoryId: "subcat-1",
        description: "Fresh milk",
        imageUrl: "http://example.com/milk.png"
      });

      // Expect original variant PUT call with isActive: false
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/products/prod-xyz/variants/var-1", {
        label: "500ml",
        price: 30,
        stockQty: 20,
        unit: "packet",
        lowStockThreshold: 5,
        isActive: false
      });

      // Expect newly added variant POST call
      expect(postMock).toHaveBeenCalledWith("/api/v1/store/products/prod-xyz/variants", {
        label: "1L Bottle",
        price: 55,
        stockQty: 40,
        unit: "bottle",
        lowStockThreshold: undefined
      });
    });
  });
});

