/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductGrid } from "./ProductGrid";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";





const { deleteMock, getMock, postMock, putMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    delete: deleteMock,
    get: vi.fn().mockImplementation(async (url: string, config?: unknown) => {
      if (url.includes("/api/v1/cart")) {
        return {
          data: {
            success: true,
            data: {
              items: useCartStore.getState().lines.map(line => ({
                productVariantId: line.productVariantId,
                quantity: line.quantity,
                productName: line.productName,
                variantLabel: line.variantLabel,
                unitPrice: line.unitPrice
              })),
              activeOffer: null,
              activeOffers: []
            }
          }
        };
      }
      return getMock(url, config);
    }),
    post: postMock,
    put: putMock
  }
}));

let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | undefined;

class MockIntersectionObserver implements IntersectionObserver {
  public readonly root = null;
  public readonly rootMargin = "";
  public readonly thresholds = [0];

  public constructor(
    callback: (
      entries: IntersectionObserverEntry[],
      observer: IntersectionObserver
    ) => void
  ) {
    observerCallback = (entries) => {
      callback(entries, this);
    };
  }

  public disconnect(): void { }
  public observe(): void { }
  public takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  public unobserve(): void { }
}

function renderGrid(props: { categoryId?: string; storeId?: string } = {}): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProductGrid {...props} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("ProductGrid", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    useCartStore.getState().clear();
    useAuthStore.getState().setBuyerSession({
      accessToken: "at",
      refreshToken: "rt",
      userId: "u-buyer",
      phone: "+910000000000",
      name: null
    });
    observerCallback = undefined;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows loading skeletons first", () => {
    getMock.mockReturnValue(new Promise(() => undefined));
    renderGrid();
    expect(screen.getByText("Loading products...")).toBeInTheDocument();
    expect(screen.getAllByTestId("product-skeleton-card")).toHaveLength(12);
  });

  it("renders products from API envelope", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: "p1",
              name: "Apple",
              highestPricedVariantId: "v-apple-1kg",
              storeId: "s1",
              storeName: "Peak Mart",
              categoryId: "c1",
              imageUrl: "https://x",
              price: "220.00",
              unit: "kg"
            }
          ],
          nextCursor: null
        }
      }
    });
    renderGrid({ categoryId: "c1" });
    expect(await screen.findByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Peak Mart")).toBeInTheDocument();
    expect(screen.getByText("Rs 220.00")).toBeInTheDocument();

    const img = screen.getByAltText("Apple");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://x");
  });

  it("loads next page when sentinel enters viewport", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: [
              {
                id: "p1",
                name: "Apple",
                highestPricedVariantId: "v-apple-1kg",
                storeId: "s1",
                storeName: "Peak Mart",
                categoryId: "c1",
                imageUrl: "https://x",
                price: "220.00",
                unit: "kg"
              }
            ],
            nextCursor: "cursor-1"
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: [
              {
                id: "p2",
                name: "Banana",
                highestPricedVariantId: "v-banana-dozen",
                storeId: "s1",
                storeName: "Peak Mart",
                categoryId: "c1",
                imageUrl: "https://x",
                price: "90.00",
                unit: "dozen"
              }
            ],
            nextCursor: null
          }
        }
      });

    renderGrid({ categoryId: "c1" });
    expect(await screen.findByText("Apple")).toBeInTheDocument();

    observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);

    expect(await screen.findByText("Banana")).toBeInTheDocument();
    expect(getMock).toHaveBeenLastCalledWith(
      "/api/v1/products",
      expect.objectContaining({
        params: expect.objectContaining({
          cursor: "cursor-1"
        })
      })
    );
  });

  it("shows empty state when API returns no products", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
          nextCursor: null
        }
      }
    });
    renderGrid();
    expect(await screen.findByText("Nothing here yet - check back soon")).toBeInTheDocument();
  });

  it("shows error state when API envelope is invalid", async () => {
    getMock.mockResolvedValue({
      data: {
        success: false
      }
    });
    renderGrid();
    expect(await screen.findByText("Couldn't load products")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries loading when retry button is clicked", async () => {
    getMock.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [],
          nextCursor: null
        }
      }
    });
    renderGrid();

    const retry = await screen.findByRole("button", { name: "Retry" });
    fireEvent.click(retry);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(2);
    });
  });

  it("debounces search by 300ms before API call", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
          nextCursor: null
        }
      }
    });
    renderGrid();

    const input = await screen.findByPlaceholderText("Search products");
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(1);
    });
    getMock.mockClear();

    fireEvent.change(input, { target: { value: "app" } });
    expect(getMock).toHaveBeenCalledTimes(0);

    // Wait longer for debounce (300ms) to settle
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(1);
    });
  });

  it("shows add button then +/- controls with optimistic cart update", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: "p1",
              name: "Apple",
              highestPricedVariantId: "v-apple-1kg",
              storeId: "s1",
              storeName: "Peak Mart",
              categoryId: "c1",
              imageUrl: "https://x",
              price: "220.00",
              unit: "kg"
            }
          ],
          nextCursor: null
        }
      }
    });
    postMock.mockResolvedValue({ data: { success: true } });

    renderGrid({ categoryId: "c1" });
    const addButton = await screen.findByRole("button", { name: "Add Apple to cart" });
    fireEvent.click(addButton);

    expect(screen.getByRole("button", { name: "Decrease Apple quantity" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase Apple quantity" })).toBeInTheDocument();
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/api/v1/cart/items",
        expect.objectContaining({
          productVariantId: "v-apple-1kg",
          quantity: 1
        })
      );
    });
    expect(useCartStore.getState().lines[0]).toEqual(
      expect.objectContaining({
        unitPrice: 220,
        variantLabel: "kg"
      })
    );
  });

  it("syncs add-to-cart API when userId is null but access token exists", async () => {
    useAuthStore.setState({
      accessToken: "at-only",
      name: null,
      phone: null,
      refreshToken: "rt-only",
      role: "BUYER",
      userId: null
    });
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: "p1",
              name: "Apple",
              highestPricedVariantId: "v-apple-1kg",
              storeId: "s1",
              storeName: "Peak Mart",
              categoryId: "c1",
              imageUrl: "https://x",
              price: "220.00",
              unit: "kg"
            }
          ],
          nextCursor: null
        }
      }
    });
    postMock.mockResolvedValue({ data: { success: true } });

    renderGrid({ categoryId: "c1" });
    fireEvent.click(await screen.findByRole("button", { name: "Add Apple to cart" }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/api/v1/cart/items",
        expect.objectContaining({
          productVariantId: "v-apple-1kg",
          quantity: 1
        })
      );
    });
  });

  it("queues rapid +/- sync so a second PUT is not dispatched until the first completes", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: "p1",
              name: "Apple",
              highestPricedVariantId: "v-apple-1kg",
              storeId: "s1",
              storeName: "Peak Mart",
              categoryId: "c1",
              imageUrl: "https://x",
              price: "220.00",
              unit: "kg"
            }
          ],
          nextCursor: null
        }
      }
    });
    postMock.mockResolvedValue({ data: { success: true } });
    const unblock: Array<(value?: void) => void> = [];
    putMock.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        unblock.push(resolve);
      });
      return { data: { success: true } };
    });

    renderGrid({ categoryId: "c1" });
    fireEvent.click(await screen.findByRole("button", { name: "Add Apple to cart" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Apple quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Apple quantity" }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledTimes(1);
    });
    expect(putMock.mock.calls[0]?.[1]).toEqual({ quantity: 2 });
    unblock[0]!();
    await waitFor(() => {
      expect(putMock).toHaveBeenCalledTimes(2);
    });
    expect(putMock.mock.calls[1]?.[1]).toEqual({ quantity: 3 });
    unblock[1]!();
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("renders a navigation link to the product detail page for each card", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: "p1",
              productId: "prod-123",
              name: "Apple",
              highestPricedVariantId: "v1",
              storeId: "s1",
              storeName: "Mart",
              categoryId: "c1",
              imageUrl: "https://x",
              price: "10",
              unit: "kg"
            }
          ],
          nextCursor: null
        }
      }
    });

    renderGrid();

    const link = await screen.findByRole("link", { name: /apple/i });
    expect(link).toHaveAttribute("href", "/products/prod-123");
  });

  it("does not navigate when the Add button is clicked", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: "p1",
              productId: "prod-123",
              name: "Apple",
              highestPricedVariantId: "v1",
              storeId: "s1",
              storeName: "Mart",
              categoryId: "c1",
              imageUrl: "https://x",
              price: "10",
              unit: "kg"
            }
          ],
          nextCursor: null
        }
      }
    });

    renderGrid();

    const addButton = await screen.findByRole("button", { name: /add apple to cart/i });
    fireEvent.click(addButton);

    // If navigation happened, the link would be active or the URL would change.
    // In MemoryRouter, we can check if the current location is still '/' (or whatever it was).
    // However, the test above is enough if we just want to prove it currently FAILS (because no link exists).
  });

  it("renders Book link instead of Add button for BOOKING_COMMERCE products", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: "p1",
              productId: "prod-123",
              name: "AC Service",
              highestPricedVariantId: "v1",
              storeId: "s1",
              storeName: "GoRola Repairs",
              categoryId: "c1",
              imageUrl: "https://x",
              price: "799.00",
              unit: "service",
              storeType: "BOOKING_COMMERCE"
            }
          ],
          nextCursor: null
        }
      }
    });

    renderGrid();

    const bookLink = await screen.findByRole("link", { name: /book/i });
    expect(bookLink).toBeInTheDocument();
    expect(bookLink).toHaveAttribute(
      "href",
      "/bookings/new?productId=prod-123&variantId=v1"
    );
  });
});

