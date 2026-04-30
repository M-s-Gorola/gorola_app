import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryPage } from "./CategoryPage";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock
  }
}));

function renderPage(initialPath: string): void {
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
          <Route path="/categories/:slug" element={<CategoryPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("CategoryPage", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("resolves slug to categoryId and requests products with categoryId filter", async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/categories") {
        return {
          data: {
            success: true,
            data: [
              { id: "cat-groceries", slug: "groceries", name: "Groceries", emoji: "🥬", productCount: 1 }
            ]
          }
        };
      }
      if (url === "/api/v1/products") {
        return {
          data: {
            success: true,
            data: {
              items: [],
              nextCursor: null
            }
          }
        };
      }
      throw new Error(`Unexpected API call: ${url}`);
    });

    renderPage("/categories/groceries");

    expect(await screen.findByRole("heading", { name: "Groceries" })).toBeInTheDocument();
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        "/api/v1/products",
        expect.objectContaining({
          params: expect.objectContaining({
            categoryId: "cat-groceries"
          })
        })
      );
    });
  });

  it("does not request unfiltered products before category id resolves", async () => {
    let releaseCategories: (() => void) | null = null;
    const categoriesWait = new Promise<void>((resolve) => {
      releaseCategories = resolve;
    });

    getMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/categories") {
        await categoriesWait;
        return {
          data: {
            success: true,
            data: [{ id: "cat-medical", slug: "medical", name: "Medical", emoji: "💊", productCount: 1 }]
          }
        };
      }
      if (url === "/api/v1/products") {
        return {
          data: {
            success: true,
            data: {
              items: [],
              nextCursor: null
            }
          }
        };
      }
      throw new Error(`Unexpected API call: ${url}`);
    });

    renderPage("/categories/medical");
    expect(await screen.findByText("Resolving category...")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith("/api/v1/categories");

    releaseCategories?.();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        "/api/v1/products",
        expect.objectContaining({
          params: expect.objectContaining({
            categoryId: "cat-medical"
          })
        })
      );
    });
  });
});
