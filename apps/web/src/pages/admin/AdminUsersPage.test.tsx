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
          <Route path="/admin/users/:id" element={<div>User Detail Full Page</div>} />
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

    // Suspend Toggle confirmation dialog
    putMock.mockResolvedValueOnce({ data: { success: true } });
    getMock.mockResolvedValueOnce({ data: mockUsersData }); // list refresh mock

    const toggleBtn = screen.getByTestId("toggle-status-user-1");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Suspend User Account?")).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-status-change");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/users/user-1/suspend", {});
    });
  });

  it("navigates to dedicated user detail full page when clicking View Details", async () => {
    const mockUsersData = {
      success: true,
      data: [
        {
          id: "user-1",
          maskedPhone: "*********3210",
          name: "Abhishek Sharma",
          orderCount: 1,
          totalSpent: 100.0,
          createdAt: "2026-06-04T12:00:00.000Z",
          isActive: true
        }
      ]
    };

    getMock.mockResolvedValueOnce({ data: mockUsersData });

    renderAdminUsers();

    expect(await screen.findByText("Platform Users")).toBeInTheDocument();

    const detailsBtn = screen.getByTestId("view-details-user-1");
    fireEvent.click(detailsBtn);

    // Verify router navigated to detail full page
    expect(await screen.findByText("User Detail Full Page")).toBeInTheDocument();
  });
});
