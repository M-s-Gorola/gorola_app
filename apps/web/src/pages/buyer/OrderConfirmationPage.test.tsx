import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderConfirmationPage } from "./OrderConfirmationPage";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock
  }
}));

function renderPage(initialPath = "/orders/o-1"): void {
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
          <Route path="/orders/:id" element={<OrderConfirmationPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("OrderConfirmationPage", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("loads order detail and shows totals including discount amount", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: "o-1",
          subtotal: "200.00",
          deliveryFee: "30.00",
          total: "220.00",
          paymentMethod: "COD",
          discount: {
            amount: "10.00",
            code: "SAVE10"
          }
        }
      }
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Order Confirmation" })).toBeInTheDocument();
    expect(screen.getByText("Order ID: o-1")).toBeInTheDocument();
    expect(await screen.findByText("Subtotal: Rs 200.00")).toBeInTheDocument();
    expect(screen.getByText("Delivery fee: Rs 30.00")).toBeInTheDocument();
    expect(screen.getByText("Discount: -Rs 10.00")).toBeInTheDocument();
    expect(screen.getByText("Total: Rs 220.00")).toBeInTheDocument();
    expect(screen.getByText("Payment: COD")).toBeInTheDocument();
  });
});
