import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";

import { StoreLayout } from "./StoreLayout";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: vi.fn()
  }
}));

function renderStoreLayout(children: ReactNode = <div>Content</div>): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <StoreLayout>{children}</StoreLayout>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreLayout Navigation", () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthStore.setState({
      accessToken: "mock-token",
      refreshToken: "mock-refresh",
      userId: "owner-id",
      storeId: "store-id"
    });
  });

  it("shows the Orders tab for retail stores (QUICK_COMMERCE)", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          storeType: "QUICK_COMMERCE"
        }
      }
    });

    renderStoreLayout();

    const orderElements = await screen.findAllByText("Orders");
    expect(orderElements.length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Bookings")).toHaveLength(0);
  });

  it("omits the Orders tab and shows Bookings for BOOKING_COMMERCE stores", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          storeType: "BOOKING_COMMERCE"
        }
      }
    });

    renderStoreLayout();

    const bookingElements = await screen.findAllByText("Bookings");
    expect(bookingElements.length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Orders")).toHaveLength(0);
  });
});
