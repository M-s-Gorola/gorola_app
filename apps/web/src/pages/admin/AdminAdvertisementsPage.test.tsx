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

  it("renders 20-per-page pagination controls and navigates between pages", async () => {
    const page1Ads = Array.from({ length: 20 }, (_, i) => ({
      id: `ad-${i + 1}`,
      storeId: `store-${i + 1}`,
      storeName: `Store ${i + 1}`,
      title: `Ad Title ${i + 1}`,
      imageUrl: "https://test.com/img.png",
      linkUrl: "https://test.com/link",
      startsAt: "2026-12-01T00:00:00.000Z",
      endsAt: "2026-12-25T00:00:00.000Z",
      isApproved: false,
      isActive: true,
      submittedAt: "2026-11-20T10:00:00.000Z"
    }));

    getMock.mockImplementation((url: string) => {
      if (url.includes("page=2")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [
                {
                  id: "ad-21",
                  storeId: "store-21",
                  storeName: "Store 21",
                  title: "Ad Title 21",
                  imageUrl: "https://test.com/img21.png",
                  linkUrl: "https://test.com/link21",
                  startsAt: "2026-12-01T00:00:00.000Z",
                  endsAt: "2026-12-25T00:00:00.000Z",
                  isApproved: false,
                  isActive: true,
                  submittedAt: "2026-11-20T10:00:00.000Z"
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
            items: page1Ads,
            total: 21,
            page: 1,
            limit: 20,
            totalPages: 2
          }
        }
      });
    });

    renderAdminAdvertisements();

    expect(await screen.findByText("Ad Title 1")).toBeInTheDocument();

    const paginationFooter = await screen.findByTestId("admin-advertisements-pagination");
    expect(paginationFooter).toBeInTheDocument();
    expect(paginationFooter).toHaveTextContent(/page 1 of 2/i);

    const nextBtn = screen.getByTestId("pagination-next-btn");
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);

    expect(await screen.findByText("Ad Title 21")).toBeInTheDocument();
    expect(screen.getByTestId("admin-advertisements-pagination")).toHaveTextContent(/page 2 of 2/i);
  });

  it("boundary test: exactly 20 advertisements renders page 1 of 1 and next button is disabled", async () => {
    const page1Ads = Array.from({ length: 20 }, (_, i) => ({
      id: `exact-ad-${i + 1}`,
      storeId: `store-${i + 1}`,
      storeName: `Exact Store ${i + 1}`,
      title: `Exact Ad ${i + 1}`,
      imageUrl: "https://test.com/img.png",
      linkUrl: "https://test.com/link",
      startsAt: "2026-12-01T00:00:00.000Z",
      endsAt: "2026-12-25T00:00:00.000Z",
      isApproved: false,
      isActive: true,
      submittedAt: "2026-11-20T10:00:00.000Z"
    }));

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: page1Ads,
          total: 20,
          page: 1,
          limit: 20,
          totalPages: 1
        }
      }
    });

    renderAdminAdvertisements();

    expect(await screen.findByText("Exact Ad 1")).toBeInTheDocument();
    const paginationFooter = await screen.findByTestId("admin-advertisements-pagination");
    expect(paginationFooter).toBeInTheDocument();
    expect(paginationFooter).toHaveTextContent(/page 1 of 1/i);

    const nextBtn = screen.getByTestId("pagination-next-btn");
    expect(nextBtn).toBeDisabled();
  });
});
