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
          { id: "c1", slug: "groceries", name: "Groceries", imageUrl: "https://example.com/groc.jpg", productCount: 12, commerceType: "QUICK_COMMERCE" },
          { id: "c2", slug: "medical", name: "Medical", imageUrl: "https://example.com/med.jpg", productCount: 7, commerceType: "QUICK_COMMERCE" }
        ]
      }
    });

    renderGrid();

    const groceriesBtn = await screen.findByRole("button", { name: /groceries/i });
    expect(groceriesBtn).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /medical/i })).toBeInTheDocument();

    // Verify product counts are NOT rendered on the card
    expect(screen.queryByText(/12 Products/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/7 Products/i)).not.toBeInTheDocument();

    // Verify image sources
    expect(screen.getByAltText(/groceries category/i)).toHaveAttribute("src", "https://example.com/groc.jpg");
    expect(screen.getByAltText(/medical category/i)).toHaveAttribute("src", "https://example.com/med.jpg");

    // Verify card styling matches product grid consistency (vertical layout, no horizontal flex)
    const cards = screen.getAllByTestId("category-card");
    expect(cards[0]).toHaveClass("flex-col");
    expect(cards[0]).not.toHaveClass("sm:flex-row");

    // Verify image wrapper has the aspect-square styling classes
    const imgWrapper = screen.getByAltText(/groceries category/i).parentElement;
    expect(imgWrapper).toHaveClass("aspect-square");
    expect(imgWrapper).toHaveClass("w-full");
    expect(imgWrapper).toHaveClass("rounded-xl");

    fireEvent.click(groceriesBtn);
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
