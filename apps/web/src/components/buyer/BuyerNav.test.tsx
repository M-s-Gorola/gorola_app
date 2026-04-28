import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { BuyerNav } from "@/components/buyer/BuyerNav";
import { useCartStore } from "@/store/cart.store";
import { useWeatherStore } from "@/store/weather.store";

function SearchDebugPage() {
  const location = useLocation();
  return <p data-testid="search-location">{location.pathname + location.search}</p>;
}

describe("BuyerNav", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
    useWeatherStore.setState({ isWeatherMode: false });
  });

  it("renders mountain logo and location pill", () => {
    render(
      <MemoryRouter>
        <BuyerNav />
      </MemoryRouter>
    );
    expect(screen.getByLabelText("GoRola mountain logo")).toBeInTheDocument();
    expect(screen.getByText(/Kulri, Mussoorie/i)).toBeInTheDocument();
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

  it("navigates to /search on Enter from search input", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<BuyerNav />} />
          <Route path="/search" element={<SearchDebugPage />} />
        </Routes>
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(input, { target: { value: "bread" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
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
});
