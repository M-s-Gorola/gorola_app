import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BuyerNav } from "@/components/buyer/BuyerNav";
import { useBuyerLocation } from "@/hooks/useBuyerLocation";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useWeatherStore } from "@/store/weather.store";

const { postMock, getMock, refetchMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getMock: vi.fn(),
  refetchMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: postMock,
    get: getMock
  }
}));

vi.mock("@/hooks/useSearchSuggestions", () => ({
  useSearchSuggestions: vi.fn().mockReturnValue({ data: [], isLoading: false })
}));

vi.mock("@/hooks/useBuyerLocation", () => ({
  useBuyerLocation: vi.fn().mockReturnValue({
    locationLabel: "Test Colony, Dehradun",
    isLoading: false,
    coords: null,
    error: null,
    refetch: refetchMock
  })
}));

function SearchDebugPage() {
  const location = useLocation();
  return <p data-testid="search-location">{location.pathname + location.search}</p>;
}

describe("BuyerNav", () => {
  beforeEach(() => {
    postMock.mockReset();
    useCartStore.setState({ lines: [] });
    useWeatherStore.setState({ isWeatherMode: false });
    useAuthStore.getState().clearSession();
    vi.mocked(useBuyerLocation).mockReturnValue({
      locationLabel: "Test Colony, Dehradun",
      isLoading: false,
      coords: { lat: 30.3165, lng: 78.0322 },
      error: null,
      refetch: refetchMock
    });
  });

  it("renders mountain logo and location icon button", () => {
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    expect(screen.getByLabelText("GoRola mountain logo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Current Location/i })).toBeInTheDocument();
  });

  it("does not render the location icon button when location is loading", () => {
    vi.mocked(useBuyerLocation).mockReturnValue({
      locationLabel: "Mussoorie",
      isLoading: true,
      coords: null,
      error: null,
      refetch: refetchMock
    });
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: /Current Location/i })).not.toBeInTheDocument();
  });

  it("shows cart badge count from cart store", () => {
    useCartStore.setState({
      lines: [{ productVariantId: "pv-1", quantity: 3, productName: "Apple", variantLabel: "1kg" }]
    });
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    expect(screen.getByLabelText("Cart items")).toHaveTextContent("3");
  });

  it("navigates to /search on Enter from search input", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<BuyerNav />} />
          <Route path="/search" element={<SearchDebugPage />} />
        </Routes>
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText(/Search/i);
    await user.type(input, "bread{enter}");
    expect(screen.getByTestId("search-location")).toHaveTextContent("/search?q=bread");
  });

  it("switches nav weather data attribute when weather mode is on", () => {
    useWeatherStore.setState({ isWeatherMode: true });
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    expect(screen.getByRole("navigation")).toHaveAttribute("data-weather", "on");
  });

  it("shows buyer identity and logout when buyer session exists", () => {
    useAuthStore.setState({
      accessToken: "access",
      name: "Naveen",
      phone: "+919876543210",
      refreshToken: "refresh",
      role: "BUYER",
      userId: "buyer_1"
    });
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    // Updated expectation: Profile should be icon-only in the nav
    expect(screen.queryByText("Naveen")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/profile/i)).toBeInTheDocument();
  });

  it("does not render the Orders button in the navbar", () => {
    useAuthStore.setState({
      accessToken: "access",
      role: "BUYER",
      userId: "buyer_1"
    });
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Orders/i)).not.toBeInTheDocument();
  });

  it("renders Cart button as icon-only", () => {
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    const cartButton = screen.getByRole("button", { name: /cart/i });
    expect(cartButton).toBeInTheDocument();
    // It should have the icon but NO text "Cart"
    expect(cartButton).not.toHaveTextContent("Cart");
  });

  it("opens dropdown menu with Profile and Logout when clicking profile icon", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      accessToken: "access",
      name: "Naveen",
      role: "BUYER",
      userId: "buyer_1"
    });
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );

    const profileButton = screen.getByLabelText(/profile/i);
    await user.click(profileButton);

    // Dropdown items should appear
    expect(await screen.findByText("Profile")).toBeInTheDocument();
    expect(await screen.findByText("Logout")).toBeInTheDocument();
    // Orders should NOT be in the dropdown
    expect(screen.queryByText("Orders")).not.toBeInTheDocument();
  });

  it("calls backend logout when clicking Logout in dropdown", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ data: { success: true } });
    useAuthStore.setState({
      accessToken: "access",
      refreshToken: "refresh-token",
      role: "BUYER",
      userId: "buyer_1"
    });
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );

    await user.click(screen.getByLabelText(/profile/i));
    const logoutItem = await screen.findByText("Logout");
    await user.click(logoutItem);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/buyer/logout", {
        refreshToken: "refresh-token"
      });
    });
  });

  it("wraps search input in a form for mobile keyboard support", () => {
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText(/Search/i);
    const form = input.closest("form");
    expect(form).toBeInTheDocument();
  });

  it("hides branding on mobile screens but keeps location pill visible", () => {
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    const branding = screen.getByAltText("GoRola");
    const locationPill = screen.getByRole("button", { name: /Current Location/i });

    expect(branding).toHaveClass("hidden", "sm:block");
    expect(locationPill).toBeInTheDocument();
    expect(locationPill).toHaveClass("flex");
  });

  it("hides cart and profile buttons container on mobile screens", () => {
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    const rightContainer = screen.getByRole("button", { name: /cart/i }).parentElement;
    expect(rightContainer).toHaveClass("hidden", "sm:flex");
  });

  it("shows suggestions dropdown when typing in the search bar and navigates when clicking a suggestion", async () => {
    const user = userEvent.setup();
    
    vi.mocked(useSearchSuggestions).mockImplementation((query: string) => {
      if (query === "cough") {
        return {
          data: [
            {
              id: "prod-1",
              name: "Cough Syrup",
              type: "product",
              redirectUrl: "/products/prod-1"
            },
            {
              id: "cat-1",
              name: "Cough Category",
              type: "category",
              redirectUrl: "/categories/cough-category"
            }
          ],
          isLoading: false
        } as unknown as ReturnType<typeof useSearchSuggestions>;
      }
      return { data: [], isLoading: false } as unknown as ReturnType<typeof useSearchSuggestions>;
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<BuyerNav />} />
          <Route path="/products/prod-1" element={<p data-testid="target">Product Details Page</p>} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search/i);
    await user.type(input, "cough");

    // Wait for the dropdown suggestion to appear
    const suggestionItem = await screen.findByText("Cough Syrup");
    expect(suggestionItem).toBeInTheDocument();
    
    // Type badge should be rendered
    const typeBadge = screen.getByText("product");
    expect(typeBadge).toBeInTheDocument();

    // Click it and verify navigation
    await user.click(suggestionItem);
    expect(screen.getByTestId("target")).toHaveTextContent("Product Details Page");
  });

  it("opens location popup on click and calls refetch when clicking refresh button", async () => {
    const user = userEvent.setup();
    refetchMock.mockClear();

    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );

    const locationButton = screen.getByRole("button", { name: /Current Location/i });
    expect(screen.queryByRole("heading", { name: "Current Location" })).not.toBeInTheDocument();

    await user.click(locationButton);

    expect(screen.getByRole("heading", { name: "Current Location" })).toBeInTheDocument();
    expect(screen.getByText("Test Colony, Dehradun")).toBeInTheDocument();
    expect(screen.queryByText(/Coordinates/i)).not.toBeInTheDocument();

    const refreshButton = screen.getByRole("button", { name: /Refresh Location/i });
    await user.click(refreshButton);

    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it("does not render the location icon button when permission is denied", () => {
    vi.mocked(useBuyerLocation).mockReturnValue({
      locationLabel: "Mussoorie",
      isLoading: false,
      coords: null,
      error: "PERMISSION_DENIED",
      refetch: refetchMock
    });

    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /Current Location/i })).not.toBeInTheDocument();
  });
});

