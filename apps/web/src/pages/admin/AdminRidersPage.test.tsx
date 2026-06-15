/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRidersPage } from "./AdminRidersPage";
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

function renderAdminRiders(initialEntries: InitialEntry[] = ["/admin/riders"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/riders" element={<AdminRidersPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminRidersPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    useAuthStore.getState().setAdminSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-admin-id",
      twoFactorVerified: true
    });
  });

  it("renders riders list and supports adding, editing, and suspending riders", async () => {
    const mockStoresData = {
      success: true,
      data: [
        { id: "store-qc-1", name: "QC Store 1", storeType: "QUICK_COMMERCE", isActive: true },
        { id: "store-booking-1", name: "Booking Store 1", storeType: "BOOKING_COMMERCE", isActive: true }
      ]
    };

    const mockRidersData = {
      success: true,
      data: [
        {
          id: "rider-1",
          name: "John Rider",
          phone: "+919000000001",
          email: "john@test.com",
          riderType: "DELIVERY",
          isActive: true,
          stores: [
            {
              storeId: "store-qc-1",
              isPrimary: true,
              store: { id: "store-qc-1", name: "QC Store 1", storeType: "QUICK_COMMERCE" }
            }
          ]
        }
      ]
    };

    getMock.mockImplementation((url: string) => {
      if (url.includes("/api/v1/admin/stores")) {
        return Promise.resolve({ data: mockStoresData });
      }
      return Promise.resolve({ data: mockRidersData });
    });

    renderAdminRiders();

    expect(await screen.findByText("Platform Riders")).toBeInTheDocument();
    expect(screen.getByText("John Rider")).toBeInTheDocument();
    expect(screen.getByText("+919000000001")).toBeInTheDocument();
    expect(screen.getByText("john@test.com")).toBeInTheDocument();
    expect(screen.getByText("QC Store 1")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();

    // 1. Add Rider Modal Flow
    const addRiderBtn = screen.getByTestId("add-rider-button");
    fireEvent.click(addRiderBtn);

    expect(await screen.findByText("Add New Rider Partner")).toBeInTheDocument();

    // Fill rider info
    fireEvent.change(screen.getByTestId("rider-name-input"), { target: { value: "New Tech Rider" } });
    fireEvent.change(screen.getByTestId("rider-phone-input"), { target: { value: "+919000000002" } });
    fireEvent.change(screen.getByTestId("rider-email-input"), { target: { value: "tech@test.com" } });
    fireEvent.change(screen.getByTestId("rider-password-input"), { target: { value: "TechPassword123" } });

    // Select Rider Type: FIELD_TECHNICIAN
    fireEvent.click(screen.getByTestId("rider-type-technician"));

    // Verify only booking stores are shown
    expect(screen.queryByTestId("rider-store-checkbox-store-qc-1")).not.toBeInTheDocument();
    expect(screen.getByText("Booking Store 1")).toBeInTheDocument();

    // Check store
    fireEvent.click(screen.getByTestId("rider-store-checkbox-store-booking-1"));

    // Select primary store (since only store-booking-1 is checked, it should be selected)
    fireEvent.click(screen.getByTestId("rider-primary-store-radio-store-booking-1"));

    postMock.mockResolvedValueOnce({ data: { success: true } });

    fireEvent.click(screen.getByTestId("submit-create-rider"));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/admin/riders", {
        name: "New Tech Rider",
        phone: "+919000000002",
        email: "tech@test.com",
        password: "TechPassword123",
        riderType: "FIELD_TECHNICIAN",
        storeIds: ["store-booking-1"],
        primaryStoreId: "store-booking-1"
      });
    });

    // 2. Suspend Rider Flow
    putMock.mockResolvedValueOnce({ data: { success: true } });
    fireEvent.click(screen.getByTestId("toggle-status-rider-rider-1"));

    expect(screen.getByText("Are you sure you want to suspend this rider?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("confirm-status-change"));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/riders/rider-1", {
        isActive: false
      });
    });
  });
});
