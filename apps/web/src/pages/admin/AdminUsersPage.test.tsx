/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminUsersPage } from "./AdminUsersPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string) => getMock(url)),
    post: vi.fn(),
    put: vi.fn((url: string, body: unknown) => putMock(url, body))
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

function renderAdminUsers(initialEntries: InitialEntry[] = ["/admin/users"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    useAuthStore.getState().setAdminSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-admin-id",
      twoFactorVerified: true
    });
  });

  it("renders users list and handles search and suspension", async () => {
    const mockUsersData = {
      success: true,
      data: [
        {
          id: "user-1",
          maskedPhone: "*********3210",
          name: "Abhishek Sharma",
          orderCount: 3,
          totalSpent: 350.0,
          createdAt: "2026-06-04T12:00:00.000Z",
          isActive: true
        }
      ]
    };

    getMock.mockResolvedValueOnce({ data: mockUsersData });

    renderAdminUsers();

    // Verify page title and structure
    expect(await screen.findByText("Platform Users")).toBeInTheDocument();
    expect(screen.getByTestId("search-phone-input")).toBeInTheDocument();

    // Verify row items
    expect(screen.getByText("Abhishek Sharma")).toBeInTheDocument();
    expect(screen.getByText("*********3210")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("₹350.00")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    // Mock detail endpoint when opening drawer
    const mockUserDetail = {
      success: true,
      data: {
        id: "user-1",
        name: "Abhishek Sharma",
        maskedPhone: "*********3210",
        isActive: true,
        createdAt: "2026-06-04T12:00:00.000Z",
        orders: [
          { id: "order-1", storeName: "Milk Palace", total: 150.0, status: "DELIVERED", createdAt: "2026-06-04T12:00:00.000Z" }
        ],
        addresses: [
          { id: "addr-1", flatRoom: "Room 10", landmarkDescription: "Near Park" }
        ]
      }
    };

    getMock.mockResolvedValueOnce({ data: mockUserDetail });

    // Click "View Details" row / button
    const detailsBtn = screen.getByTestId("view-details-user-1");
    fireEvent.click(detailsBtn);

    // Verify drawer details
    expect(await screen.findByTestId("user-details-drawer")).toBeInTheDocument();
    expect(await screen.findByText("Milk Palace")).toBeInTheDocument();
    expect(screen.getByText(/Room 10/)).toBeInTheDocument();
    expect(screen.getByText(/Near Park/)).toBeInTheDocument();

    // Suspend Toggle confirmation dialog
    putMock.mockResolvedValueOnce({ data: { success: true } });
    getMock.mockResolvedValueOnce({ data: mockUsersData }); // list refresh mock

    const toggleBtn = screen.getByTestId("toggle-status-user-1");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Are you sure you want to suspend this user?")).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-status-change");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/users/user-1/suspend", {});
    });
  });
});
