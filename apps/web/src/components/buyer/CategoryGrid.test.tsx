import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryGrid } from "./CategoryGrid";

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
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

function renderGrid(): void {
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
        <CategoryGrid />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("CategoryGrid", () => {
  beforeEach(() => {
    getMock.mockReset();
    navigateMock.mockReset();
  });

  it("shows loading skeletons first", () => {
    getMock.mockReturnValue(new Promise(() => undefined));
    renderGrid();
    expect(screen.getByText("Loading categories...")).toBeInTheDocument();
  });

  it("shows categories from API and navigates on click", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          { id: "c1", slug: "groceries", name: "Groceries", emoji: "🥬", productCount: 12 },
          { id: "c2", slug: "medical", name: "Medical", emoji: "💊", productCount: 7 }
        ]
      }
    });

    renderGrid();

    expect(await screen.findByRole("button", { name: /groceries/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /medical/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /groceries/i }));
    expect(navigateMock).toHaveBeenCalledWith("/categories/groceries");
  });

  it("shows empty state when API has no categories", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });

    renderGrid();
    expect(await screen.findByText("No categories available")).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    getMock.mockRejectedValue(new Error("network"));

    renderGrid();
    expect(await screen.findByText("Couldn't load categories - tap to retry")).toBeInTheDocument();
  });
});
