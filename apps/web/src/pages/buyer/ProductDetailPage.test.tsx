import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductDetailPage } from "./ProductDetailPage";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock
  }
}));

function renderPage(initialPath = "/products/p1"): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("ProductDetailPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    useCartStore.getState().clear();
    useAuthStore.getState().setBuyerSession({
      accessToken: "at",
      refreshToken: "rt",
      userId: "u-buyer",
      phone: "+910000000000",
      name: null
    });
  });

  it("shows loading skeleton while request is pending", () => {
    getMock.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByTestId("product-detail-skeleton")).toBeInTheDocument();
  });

  it("renders product detail and variant selector from API response", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "p1",
          name: "Apple",
          description: "Fresh apple",
          imageUrl: "https://cdn.example.com/apple.jpg",
          store: {
            id: "s1",
            name: "Peak Mart",
            phone: "+919111111111"
          },
          variants: [
            { id: "v1", label: "500g", price: "120.00", unit: "g", stockQty: 5 },
            { id: "v2", label: "1kg", price: "220.00", unit: "kg", stockQty: 8 }
          ]
        }
      }
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "500g" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1kg" })).toBeInTheDocument();
    expect(screen.getByText("Rs 120.00")).toBeInTheDocument();
  });

  it("updates displayed price when variant changes", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "p1",
          name: "Apple",
          description: "Fresh apple",
          imageUrl: "https://cdn.example.com/apple.jpg",
          store: {
            id: "s1",
            name: "Peak Mart",
            phone: "+919111111111"
          },
          variants: [
            { id: "v1", label: "500g", price: "120.00", unit: "g", stockQty: 5 },
            { id: "v2", label: "1kg", price: "220.00", unit: "kg", stockQty: 8 }
          ]
        }
      }
    });

    renderPage();
    await screen.findByRole("heading", { name: "Apple" });
    fireEvent.click(screen.getByRole("button", { name: "1kg" }));
    expect(screen.getByText("Rs 220.00")).toBeInTheDocument();
  });

  it("posts selected variant and quantity when add to cart is clicked", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "p1",
          name: "Apple",
          description: "Fresh apple",
          imageUrl: "https://cdn.example.com/apple.jpg",
          store: {
            id: "s1",
            name: "Peak Mart",
            phone: "+919111111111"
          },
          variants: [
            { id: "v1", label: "500g", price: "120.00", unit: "g", stockQty: 5 },
            { id: "v2", label: "1kg", price: "220.00", unit: "kg", stockQty: 8 }
          ]
        }
      }
    });
    postMock.mockResolvedValue({ data: { success: true } });

    renderPage();
    await screen.findByRole("heading", { name: "Apple" });
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(postMock).toHaveBeenCalledWith("/api/v1/cart/items", {
      userId: "u-buyer",
      productVariantId: "v1",
      quantity: 2
    });
    expect(useCartStore.getState().lines[0]).toEqual(
      expect.objectContaining({
        productVariantId: "v1",
        quantity: 2,
        unitPrice: 120,
        variantLabel: "500g"
      })
    );
  });

  it("caps quantity at selected variant stock", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "p1",
          name: "Apple",
          description: "Fresh apple",
          imageUrl: "https://cdn.example.com/apple.jpg",
          store: {
            id: "s1",
            name: "Peak Mart",
            phone: "+919111111111"
          },
          variants: [{ id: "v1", label: "500g", price: "120.00", unit: "g", stockQty: 2 }]
        }
      }
    });
    postMock.mockResolvedValue({ data: { success: true } });

    renderPage();
    await screen.findByRole("heading", { name: "Apple" });
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(postMock).toHaveBeenCalledWith("/api/v1/cart/items", {
      userId: "u-buyer",
      productVariantId: "v1",
      quantity: 2
    });
  });

  it("shows an error state when detail API response fails", async () => {
    getMock.mockResolvedValue({
      data: {
        success: false
      }
    });

    renderPage();
    expect(await screen.findByText("Could not load product details")).toBeInTheDocument();
  });

  it("disables add-to-cart for out-of-stock selected variant", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "p1",
          name: "Apple",
          description: "Fresh apple",
          imageUrl: "https://cdn.example.com/apple.jpg",
          store: {
            id: "s1",
            name: "Peak Mart",
            phone: "+919111111111"
          },
          variants: [{ id: "v1", label: "500g", price: "120.00", unit: "g", stockQty: 0 }]
        }
      }
    });
    postMock.mockResolvedValue({ data: { success: true } });

    renderPage();
    await screen.findByRole("heading", { name: "Apple" });
    const addButton = screen.getByRole("button", { name: "Add to cart" });
    expect(addButton).toBeDisabled();
    fireEvent.click(addButton);
    expect(postMock).not.toHaveBeenCalled();
  });
});
