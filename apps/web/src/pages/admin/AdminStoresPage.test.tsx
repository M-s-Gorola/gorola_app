/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStoresPage } from "./AdminStoresPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock, postMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string) => getMock(url)),
    post: vi.fn((url: string, body: unknown) => postMock(url, body)),
    put: vi.fn((url: string, body: unknown) => putMock(url, body))
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

function renderAdminStores(initialEntries: InitialEntry[] = ["/admin/stores"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/stores" element={<AdminStoresPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminStoresPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    mockNavigate.mockReset();
    useAuthStore.getState().setAdminSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-admin-id",
      twoFactorVerified: true
    });
  });

  it("renders stores list, handles add store dialog and toggle active status", async () => {
    const mockStoresData = {
      success: true,
      data: [
        {
          id: "store-1",
          name: "Milk Palace",
          storeType: "QUICK_COMMERCE",
          ownerEmail: "owner1@test.com",
          orderCount: 12,
          revenue: 1250.0,
          productCount: 15,
          isActive: true
        }
      ]
    };

    getMock.mockResolvedValueOnce({ data: mockStoresData });

    renderAdminStores();

    // Verify title and listing headers
    expect(await screen.findByText("Platform Stores")).toBeInTheDocument();
    expect(screen.getByText("Milk Palace")).toBeInTheDocument();
    expect(screen.getByText("Quick")).toBeInTheDocument();
    expect(screen.getByText("owner1@test.com")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("₹1,250.00")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();

    // 1. Verify "Add Store" Dialog Form triggers and submits
    const addStoreBtn = screen.getByTestId("add-store-button");
    fireEvent.click(addStoreBtn);

    expect(screen.getByText("Add New Store Partner")).toBeInTheDocument();

    // Fill inputs
    fireEvent.change(screen.getByTestId("store-name-input"), { target: { value: "Organic Veggies" } });
    fireEvent.change(screen.getByTestId("store-desc-input"), { target: { value: "Fresh from the farm" } });
    fireEvent.change(screen.getByTestId("store-phone-input"), { target: { value: "+919999888877" } });
    fireEvent.change(screen.getByTestId("store-address-input"), { target: { value: "Sector 15, Metro Plaza" } });
    fireEvent.change(screen.getByTestId("owner-email-input"), { target: { value: "owner2@test.com" } });
    fireEvent.change(screen.getByTestId("owner-password-input"), { target: { value: "TempPassword123!" } });

    // Select storeType: Booking Commerce radio
    const bookingRadio = screen.getByLabelText(/Booking Commerce/i);
    fireEvent.click(bookingRadio);

    // Mock post call and get refetch call
    postMock.mockResolvedValueOnce({ data: { success: true, data: { storeId: "store-2" } } });
    getMock.mockResolvedValueOnce({ data: mockStoresData }); // refetch mock

    const submitBtn = screen.getByTestId("submit-create-store");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/admin/stores", {
        storeName: "Organic Veggies",
        description: "Fresh from the farm",
        phone: "+919999888877",
        landmarkAddress: "Sector 15, Metro Plaza",
        storeType: "BOOKING_COMMERCE",
        ownerEmail: "owner2@test.com",
        ownerTempPassword: "TempPassword123!"
      });
    });

    // 2. View details
    const detailsBtn = screen.getByTestId("view-details-store-1");
    fireEvent.click(detailsBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/stores/store-1");

    // 3. Toggle active / inactive status
    putMock.mockResolvedValueOnce({ data: { success: true } });
    getMock.mockResolvedValueOnce({ data: mockStoresData }); // refetch mock

    const toggleBtn = screen.getByTestId("toggle-status-store-1");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Are you sure you want to suspend this store?")).toBeInTheDocument();

    const confirmToggleBtn = screen.getByTestId("confirm-status-change");
    fireEvent.click(confirmToggleBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/stores/store-1/status", {
        isActive: false
      });
    });
  });

  it("renders 20-per-page pagination controls and navigates between pages", async () => {
    const page1Stores = Array.from({ length: 20 }, (_, i) => ({
      id: `store-${i + 1}`,
      name: `Store ${i + 1}`,
      storeType: "QUICK_COMMERCE",
      ownerEmail: `owner${i + 1}@test.com`,
      orderCount: 10,
      revenue: 500.0,
      productCount: 10,
      isActive: true
    }));

    getMock.mockImplementation((url: string) => {
      if (url.includes("page=2")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [
                {
                  id: "store-21",
                  name: "Store 21",
                  storeType: "BOOKING_COMMERCE",
                  ownerEmail: "owner21@test.com",
                  orderCount: 5,
                  revenue: 250.0,
                  productCount: 5,
                  isActive: true
                }
              ],
              total: 21,
              page: 2,
              limit: 20,
              totalPages: 2
            }
          }
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            items: page1Stores,
            total: 21,
            page: 1,
            limit: 20,
            totalPages: 2
          }
        }
      });
    });

    renderAdminStores();

    expect(await screen.findByText("Store 1")).toBeInTheDocument();

    const paginationFooter = await screen.findByTestId("admin-stores-pagination");
    expect(paginationFooter).toBeInTheDocument();
    expect(paginationFooter).toHaveTextContent(/page 1 of 2/i);

    const nextBtn = screen.getByTestId("pagination-next-btn");
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);

    expect(await screen.findByText("Store 21")).toBeInTheDocument();
    expect(screen.getByTestId("admin-stores-pagination")).toHaveTextContent(/page 2 of 2/i);
  });

  it("boundary test: exactly 20 stores renders page 1 of 1 and next button is disabled", async () => {
    const page1Stores = Array.from({ length: 20 }, (_, i) => ({
      id: `store-${i + 1}`,
      name: `Exact Store ${i + 1}`,
      storeType: "QUICK_COMMERCE",
      ownerEmail: `owner${i + 1}@test.com`,
      orderCount: 10,
      revenue: 500.0,
      productCount: 10,
      isActive: true
    }));

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: page1Stores,
          total: 20,
          page: 1,
          limit: 20,
          totalPages: 1
        }
      }
    });

    renderAdminStores();

    expect(await screen.findByText("Exact Store 1")).toBeInTheDocument();
    const paginationFooter = await screen.findByTestId("admin-stores-pagination");
    expect(paginationFooter).toBeInTheDocument();
    expect(paginationFooter).toHaveTextContent(/page 1 of 1/i);

    const nextBtn = screen.getByTestId("pagination-next-btn");
    expect(nextBtn).toBeDisabled();
  });
});
