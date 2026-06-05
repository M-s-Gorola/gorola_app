/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAdvertisementsPage } from "./AdminAdvertisementsPage";
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

function renderAdminAdvertisements(initialEntries: InitialEntry[] = ["/admin/ads"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/ads" element={<AdminAdvertisementsPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminAdvertisementsPage", () => {
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

  it("renders skeletons during loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderAdminAdvertisements();

    expect(screen.getByTestId("advertisements-loading-skeleton")).toBeInTheDocument();
  });

  it("renders error message when API call fails", async () => {
    getMock.mockRejectedValueOnce(new Error("Network Error"));

    renderAdminAdvertisements();

    expect(await screen.findByText(/failed to load advertisements/i)).toBeInTheDocument();
  });

  it("renders tabs and pending advertisements with details", async () => {
    const mockAds = {
      success: true,
      data: [
        {
          id: "ad-1",
          storeId: "store-a",
          storeName: "Hillside Groceries",
          title: "Winter Special",
          imageUrl: "https://test.com/winter.png",
          linkUrl: "https://test.com/winter",
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-25T00:00:00.000Z",
          isApproved: false,
          isActive: true,
          submittedAt: "2026-11-20T10:00:00.000Z"
        }
      ]
    };

    getMock.mockResolvedValueOnce({ data: mockAds });

    renderAdminAdvertisements();

    // Verify Title
    expect(await screen.findByText("Advertisements")).toBeInTheDocument();
    
    // Verify tabs are present
    expect(screen.getByRole("tab", { name: /pending/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /approved/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /all/i })).toBeInTheDocument();

    // Verify ad details in Pending view
    expect(screen.getByText("Winter Special")).toBeInTheDocument();
    expect(screen.getByText("Hillside Groceries")).toBeInTheDocument();
    expect(screen.getByText("https://test.com/winter")).toBeInTheDocument();
    
    // Image element exists with correct src
    const img = screen.getByRole("img", { name: /winter special/i });
    expect(img).toHaveAttribute("src", "https://test.com/winter.png");

    // Approve and Reject buttons exist
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("triggers approve mutation on clicking approve button", async () => {
    const mockAds = {
      success: true,
      data: [
        {
          id: "ad-1",
          storeId: "store-a",
          storeName: "Hillside Groceries",
          title: "Winter Special",
          imageUrl: "https://test.com/winter.png",
          linkUrl: "https://test.com/winter",
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-25T00:00:00.000Z",
          isApproved: false,
          isActive: true,
          submittedAt: "2026-11-20T10:00:00.000Z"
        }
      ]
    };

    getMock.mockResolvedValue({ data: mockAds });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminAdvertisements();

    expect(await screen.findByText("Winter Special")).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: /approve/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/advertisements/ad-1/approve", {});
    });
  });

  it("opens modal and triggers reject mutation with reason when rejecting", async () => {
    const mockAds = {
      success: true,
      data: [
        {
          id: "ad-1",
          storeId: "store-a",
          storeName: "Hillside Groceries",
          title: "Winter Special",
          imageUrl: "https://test.com/winter.png",
          linkUrl: "https://test.com/winter",
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-25T00:00:00.000Z",
          isApproved: false,
          isActive: true,
          submittedAt: "2026-11-20T10:00:00.000Z"
        }
      ]
    };

    getMock.mockResolvedValue({ data: mockAds });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminAdvertisements();

    expect(await screen.findByText("Winter Special")).toBeInTheDocument();

    const rejectBtn = screen.getByRole("button", { name: /reject/i });
    fireEvent.click(rejectBtn);

    // Dialog is visible
    expect(screen.getByText("Reject Advertisement")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirm Rejection" });
    // Should be disabled because reason input is empty
    expect(confirmBtn).toBeDisabled();

    // Type a reason
    const input = screen.getByPlaceholderText(/e.g. Image resolution is too low/i);
    fireEvent.change(input, { target: { value: "Wrong link url" } });

    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/advertisements/ad-1/reject", {
        reason: "Wrong link url"
      });
    });
  });

  it("renders approved advertisements with deactivate button and triggers deactivation", async () => {
    const mockAds = {
      success: true,
      data: [
        {
          id: "ad-1",
          storeId: "store-a",
          storeName: "Hillside Groceries",
          title: "Approved Special",
          imageUrl: "https://test.com/approved.png",
          linkUrl: "https://test.com/approved",
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-25T00:00:00.000Z",
          isApproved: true,
          isActive: true,
          submittedAt: "2026-11-20T10:00:00.000Z"
        }
      ]
    };

    getMock.mockResolvedValue({ data: mockAds });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminAdvertisements();

    // Switch to Approved tab
    const approvedTab = await screen.findByRole("tab", { name: /approved/i });
    fireEvent.click(approvedTab);

    expect(await screen.findByText("Approved Special")).toBeInTheDocument();

    const deactivateBtn = screen.getByRole("button", { name: /deactivate/i });
    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/advertisements/ad-1/deactivate", {});
    });
  });
});
