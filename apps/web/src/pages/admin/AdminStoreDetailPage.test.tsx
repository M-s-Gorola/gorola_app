import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStoreDetailPage } from "./AdminStoreDetailPage";

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    put: putMock
  }
}));

// Mock toast notification
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

function renderAdminStoreDetailPage(storeId: string): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter initialEntries={[`/admin/stores/${storeId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/stores/:id" element={<AdminStoreDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminStoreDetailPage Override Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
    putMock.mockReset();
  });

  it("renders store details and rider earning rate override card with correct initial value", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          name: "Test Store",
          description: "Description",
          phone: "+919000000000",
          address: "Address",
          storeType: "QUICK_COMMERCE",
          isActive: true,
          createdAt: "2026-07-14T00:00:00Z",
          revenue: 1000,
          productCount: 15,
          orderCount: 10,
          owners: [],
          riderEarningRatePct: 90.00
        }
      }
    });

    renderAdminStoreDetailPage("store-1");

    expect(await screen.findByText("Test Store")).toBeInTheDocument();

    const input = screen.getByTestId("store-rider-earning-rate-input") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("90");
  });

  it("submits the form with custom percentage value on save", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          name: "Test Store",
          description: "Description",
          phone: "+919000000000",
          address: "Address",
          storeType: "QUICK_COMMERCE",
          isActive: true,
          createdAt: "2026-07-14T00:00:00Z",
          revenue: 1000,
          productCount: 15,
          orderCount: 10,
          owners: [],
          riderEarningRatePct: null
        }
      }
    });

    putMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          riderEarningRatePct: 85.00
        }
      }
    });

    renderAdminStoreDetailPage("store-1");

    expect(await screen.findByText("Test Store")).toBeInTheDocument();

    const input = screen.getByTestId("store-rider-earning-rate-input") as HTMLInputElement;
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { value: "85" } });
    expect(input.value).toBe("85");

    const saveBtn = screen.getByRole("button", { name: /save earning rate/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/stores/store-1/rider-earning-rate", {
        riderEarningRatePct: 85
      });
    });
  });

  it("submits the form with null when input is cleared", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          name: "Test Store",
          description: "Description",
          phone: "+919000000000",
          address: "Address",
          storeType: "QUICK_COMMERCE",
          isActive: true,
          createdAt: "2026-07-14T00:00:00Z",
          revenue: 1000,
          productCount: 15,
          orderCount: 10,
          owners: [],
          riderEarningRatePct: 90.00
        }
      }
    });

    putMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "store-1",
          riderEarningRatePct: null
        }
      }
    });

    renderAdminStoreDetailPage("store-1");

    expect(await screen.findByText("Test Store")).toBeInTheDocument();

    const input = screen.getByTestId("store-rider-earning-rate-input") as HTMLInputElement;
    expect(input.value).toBe("90");

    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");

    const saveBtn = screen.getByRole("button", { name: /save earning rate/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/stores/store-1/rider-earning-rate", {
        riderEarningRatePct: null
      });
    });
  });
});
