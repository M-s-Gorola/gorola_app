import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreAdvertisementsPage } from "./StoreAdvertisementsPage";

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    delete: deleteMock
  }
}));

function renderStoreAdvertisements(initialEntries: InitialEntry[] = ["/store/advertisements"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/advertisements" element={<StoreAdvertisementsPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreAdvertisementsPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it("renders loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // pending

    renderStoreAdvertisements();

    expect(screen.getByTestId("ads-loading-skeleton")).toBeInTheDocument();
  });

  it("renders error state when API fails", async () => {
    getMock.mockRejectedValueOnce(new Error("Network Error"));

    renderStoreAdvertisements();

    expect(await screen.findByText(/failed to load advertisements/i)).toBeInTheDocument();
  });

  it("renders empty state when there are no advertisements", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: []
      }
    });

    renderStoreAdvertisements();

    expect(await screen.findByText(/no advertisements found/i)).toBeInTheDocument();
  });

  it("renders advertisements list with columns, checks action buttons visibility, and handles deletion", async () => {
    const mockAds = [
      {
        id: "ad-1",
        title: "Summer Sale Grocery",
        imageUrl: "https://example.com/grocery-sale.png",
        linkUrl: "https://store.gorola.com/grocery-sale",
        startsAt: "2036-06-01T00:00:00.000Z",
        endsAt: "2036-06-10T00:00:00.000Z",
        isApproved: false,
        isActive: true
      },
      {
        id: "ad-2",
        title: "Approved Premium Repairs",
        imageUrl: "https://example.com/repair-sale.png",
        linkUrl: "https://store.gorola.com/repair-sale",
        startsAt: "2036-06-11T00:00:00.000Z",
        endsAt: "2036-06-20T00:00:00.000Z",
        isApproved: true,
        isActive: true
      }
    ];

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockAds
      }
    });

    renderStoreAdvertisements();

    // Verify headers & titles are rendered
    expect(await screen.findByText("Image Preview")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Date Range")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();

    expect(screen.getByText("Summer Sale Grocery")).toBeInTheDocument();
    expect(screen.getByText("Approved Premium Repairs")).toBeInTheDocument();

    // Verify Status Badge Text
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
    expect(screen.getByText("Approved & Active")).toBeInTheDocument();

    // Verify Delete button for unapproved, and missing delete for approved ad
    const deleteBtnAd1 = screen.getByTestId("delete-ad-ad-1");
    expect(deleteBtnAd1).toBeInTheDocument();
    expect(screen.queryByTestId("delete-ad-ad-2")).not.toBeInTheDocument();

    // Trigger Deletion
    const user = userEvent.setup();
    deleteMock.mockResolvedValueOnce({
      data: {
        success: true
      }
    });

    // Mock next refetch after delete
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockAds[1]]
      }
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    await user.click(deleteBtnAd1);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("/api/v1/store/advertisements/ad-1");
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "advertisements"] });
    });
  });

  it("handles form input validation and successful submission", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });

    renderStoreAdvertisements();

    const user = userEvent.setup();

    // Fill form
    const titleInput = await screen.findByLabelText(/ad title/i);
    const imageInput = screen.getByLabelText(/image url/i);
    const targetUrlInput = screen.getByLabelText(/target url/i);
    const startsInput = screen.getByLabelText(/starts at/i);
    const endsInput = screen.getByLabelText(/ends at/i);
    const submitBtn = screen.getByRole("button", { name: /submit for approval/i });

    await user.type(titleInput, "Mega Monsoon Offer");
    await user.type(imageInput, "https://example.com/monsoon.png");
    await user.type(targetUrlInput, "https://store.gorola.com/sale");
    await user.type(startsInput, "2026-07-01T00:00");
    await user.type(endsInput, "2026-07-15T00:00");

    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "ad-new",
          title: "Mega Monsoon Offer",
          imageUrl: "https://example.com/monsoon.png",
          linkUrl: "https://store.gorola.com/sale",
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-07-15T00:00:00.000Z",
          isApproved: false,
          isActive: true
        }
      }
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    await user.click(submitBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/store/advertisements", expect.objectContaining({
        title: "Mega Monsoon Offer",
        imageUrl: "https://example.com/monsoon.png",
        linkUrl: "https://store.gorola.com/sale"
      }));
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "advertisements"] });
    });
  });
});
