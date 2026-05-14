import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";

import { SearchResultsPage } from "./SearchResultsPage";

const { getMock, navigateMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  navigateMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock
  }
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

function renderPage(query: string = ""): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  const initialPath = query ? `/search?q=${encodeURIComponent(query)}` : "/search";

  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/search" element={<SearchResultsPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("SearchResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
    navigateMock.mockReset();
    useAuthStore.setState({ isBootstrapPending: false });
  });

  it("navigates to the correct category route when a category result is clicked", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          categories: [{ id: "c1", name: "Groceries", slug: "groceries", imageUrl: null }],
          subCategories: [],
          products: []
        }
      }
    });

    renderPage("groc");

    const categoryButton = await screen.findByRole("button", { name: /Groceries/i });
    fireEvent.click(categoryButton);

    expect(navigateMock).toHaveBeenCalledWith("/categories/groceries");
  });

  it("navigates to the correct subcategory route when a subcategory result is clicked (RED TEST)", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          categories: [],
          subCategories: [
            { 
              id: "sc1", 
              name: "Snacks", 
              slug: "snacks", 
              categorySlug: "groceries", // New field from API
              imageUrl: null 
            }
          ],
          products: []
        }
      }
    });

    renderPage("snack");

    const subCategoryButton = await screen.findByRole("button", { name: /Snacks/i });
    fireEvent.click(subCategoryButton);

    // This is expected to FAIL currently because SearchResultsPage.tsx 
    // uses navigate(`/search?q=${sub.name}`)
    expect(navigateMock).toHaveBeenCalledWith("/categories/groceries/snacks");
  });
});
