/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAgeGatePage } from "./AdminAgeGatePage";
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

function renderAdminAgeGate(initialEntries: InitialEntry[] = ["/admin/age-gate"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/age-gate" element={<AdminAgeGatePage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const mockLockoutsList = {
  success: true,
  data: {
    items: [
      {
        id: "lockout-1",
        createdAt: "2026-06-01T10:00:00.000Z",
        lockedUntil: "2026-08-30T10:00:00.000Z",
        strikeCount: 1,
        isActive: true
      }
    ],
    summary: {
      activeCount: 14,
      createdLast7Days: 3
    },
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1
  }
};

describe("AdminAgeGatePage Component Tests", () => {
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

  it("renders header, summary metrics tiles, and collapsible lockout ledger", async () => {
    getMock.mockResolvedValue({ data: mockLockoutsList });

    renderAdminAgeGate();

    expect(screen.getByText(/Age Gate Case Pipeline/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("14")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText(/Created in Last 7 Days/i)).toBeInTheDocument();
      expect(screen.getByTestId("toggle-lockouts-ledger")).toBeInTheDocument();
    });
  });

  it("expands the collapsible ledger to display the 4-column table without Protected Hash", async () => {
    getMock.mockResolvedValue({ data: mockLockoutsList });

    renderAdminAgeGate();

    const toggleBtn = await screen.findByTestId("toggle-lockouts-ledger");
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText("Refusal Date")).toBeInTheDocument();
      expect(screen.getByText("Locked Until")).toBeInTheDocument();
      expect(screen.getByText("Strike Count")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.queryByText("Protected Hash")).not.toBeInTheDocument();
      expect(screen.queryByText("Actions")).not.toBeInTheDocument();
      expect(screen.getAllByText(/Active Lockout/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("validates phone input before lookup", async () => {
    getMock.mockResolvedValue({ data: mockLockoutsList });

    renderAdminAgeGate();

    const searchInput = screen.getByPlaceholderText(/Enter 10-digit mobile number/i);
    const searchBtn = screen.getByRole("button", { name: /Look Up/i });

    // Invalid phone
    fireEvent.change(searchInput, { target: { value: "12345" } });
    fireEvent.click(searchBtn);

    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter a valid 10-digit Indian mobile number/i)).toBeInTheDocument();
  });

  it("performs look up and renders lockout card and account card", async () => {
    getMock.mockResolvedValue({ data: mockLockoutsList });
    postMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          lockout: {
            id: "lock-abc",
            createdAt: "2026-06-01T10:00:00.000Z",
            lockedUntil: "2026-08-30T10:00:00.000Z",
            strikeCount: 1,
            isActive: true,
            daysRemaining: 85
          },
          account: {
            id: "user-abc",
            name: "Rohit Sharma",
            maskedPhone: "+91 ******3210",
            status: "ACTIVE",
            createdAt: "2026-01-01T10:00:00.000Z",
            ageConfirmedAt: "2026-01-01T10:00:00.000Z",
            ordersCount: 4
          }
        }
      }
    });

    renderAdminAgeGate();

    const searchInput = screen.getByPlaceholderText(/Enter 10-digit mobile number/i);
    fireEvent.change(searchInput, { target: { value: "9876543210" } });
    const searchBtn = screen.getByRole("button", { name: /Look Up/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/admin/age-gate/lookup", {
        phone: "+919876543210"
      });
      expect(screen.getByText(/85 days remaining/i)).toBeInTheDocument();
      expect(screen.getByText("Rohit Sharma")).toBeInTheDocument();
      expect(screen.getByText("+91 ******3210")).toBeInTheDocument();
    });
  });
});
