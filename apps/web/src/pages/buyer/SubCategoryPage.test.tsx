import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";

import { SubCategoryPage } from "./SubCategoryPage";

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
          <Route path="/categories/:categorySlug/:subCategorySlug" element={<SubCategoryPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("SubCategoryPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthStore.setState({ isBootstrapPending: false });
  });

  it("resolves slug to subCategoryId and requests products with subCategoryId filter", async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/categories/groceries/sub-categories") {
        return {
          data: {
            success: true,
            data: [
              { id: "sub-snacks", slug: "snacks", name: "Snacks" }
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

    renderPage("/categories/groceries/snacks");

    expect(await screen.findByRole("heading", { name: "Snacks" })).toBeInTheDocument();
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        "/api/v1/products",
        expect.objectContaining({
          params: expect.objectContaining({
            subCategoryId: "sub-snacks"
          })
        })
      );
    });
  });

  it("does not request unfiltered products before sub-category id resolves", async () => {
    let releaseSubCategories: () => void = () => {};
    const subCategoriesWait = new Promise<void>((resolve) => {
      releaseSubCategories = () => {
        resolve();
      };
    });

    getMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/categories/groceries/sub-categories") {
        await subCategoriesWait;
        return {
          data: {
            success: true,
            data: [{ id: "sub-beverages", slug: "beverages", name: "Beverages" }]
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

    renderPage("/categories/groceries/beverages");
    expect(await screen.findByText("Resolving sub-category...")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith("/api/v1/categories/groceries/sub-categories");

    releaseSubCategories();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        "/api/v1/products",
        expect.objectContaining({
          params: expect.objectContaining({
            subCategoryId: "sub-beverages"
          })
        })
      );
    });
  });
});
