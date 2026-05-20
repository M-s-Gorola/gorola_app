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

  it("renders heading and passes slug to SubCategoryGrid", async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/categories/groceries/sub-categories") {
        return {
          data: {
            success: true,
            data: [
              { id: "s1", slug: "snacks", name: "Snacks", imageUrl: "https://example.com/snack.jpg" },
              { id: "s2", slug: "beverages", name: "Beverages", imageUrl: "https://example.com/bev.jpg" }
            ]
          }
        };
      }
      throw new Error(`Unexpected API call: ${url}`);
    });

    renderPage("/categories/groceries");

    expect(await screen.findByRole("heading", { name: "Groceries" })).toBeInTheDocument();
    
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/api/v1/categories/groceries/sub-categories");
    });
    
    expect(await screen.findByText("Snacks")).toBeInTheDocument();
  });
});
