import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubCategoryGrid } from "./SubCategoryGrid";

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

function renderGrid(categorySlug: string): void {
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
        <SubCategoryGrid categorySlug={categorySlug} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("SubCategoryGrid", () => {
  beforeEach(() => {
    getMock.mockReset();
    navigateMock.mockReset();
  });

  it("shows loading skeletons first", () => {
    getMock.mockReturnValue(new Promise(() => undefined));
    renderGrid("groceries");
    expect(screen.getByText("Loading sub-categories...")).toBeInTheDocument();
  });

  it("shows sub-categories from API and navigates on click", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          { id: "s1", slug: "snacks", name: "Snacks", imageUrl: "https://example.com/snack.jpg" },
          { id: "s2", slug: "beverages", name: "Beverages", imageUrl: "https://example.com/bev.jpg" }
        ]
      }
    });

    renderGrid("groceries");

    const snacksBtn = await screen.findByRole("button", { name: /snacks/i });
    expect(snacksBtn).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beverages/i })).toBeInTheDocument();

    expect(screen.getByAltText(/snacks sub-category/i)).toHaveAttribute("src", "https://example.com/snack.jpg");
    expect(screen.getByAltText(/beverages sub-category/i)).toHaveAttribute("src", "https://example.com/bev.jpg");

    // Verify sub-category card uses vertical flex layout
    const cards = screen.getAllByTestId("subcategory-card");
    expect(cards[0]).toHaveClass("flex-col");

    // Verify sub-category card has standard aspect-square image wrapper styling (non-circular)
    const imgWrapper = screen.getByAltText(/snacks sub-category/i).parentElement;
    expect(imgWrapper).toHaveClass("aspect-square");
    expect(imgWrapper).toHaveClass("w-full");
    expect(imgWrapper).toHaveClass("rounded-xl");
    expect(imgWrapper).not.toHaveClass("rounded-full");

    // Ensure the image itself is also not circular
    expect(screen.getByAltText(/snacks sub-category/i)).not.toHaveClass("rounded-full");

    fireEvent.click(snacksBtn);
    expect(navigateMock).toHaveBeenCalledWith("/categories/groceries/snacks");
  });

  it("shows empty state when API has no sub-categories", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });

    renderGrid("groceries");
    expect(await screen.findByText("No sub-categories available")).toBeInTheDocument();
  });

  it("redirects automatically if exactly one sub-category exists", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          { id: "s1", slug: "snacks", name: "Snacks", imageUrl: "https://example.com/snack.jpg" }
        ]
      }
    });

    renderGrid("groceries");

    // Should call navigate with replace: true
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/categories/groceries/snacks", { replace: true });
    });
  });

  it("shows error state when fetch fails", async () => {
    getMock.mockRejectedValue(new Error("network"));

    renderGrid("groceries");
    expect(await screen.findByText("Couldn't load sub-categories - tap to retry")).toBeInTheDocument();
  });
});
