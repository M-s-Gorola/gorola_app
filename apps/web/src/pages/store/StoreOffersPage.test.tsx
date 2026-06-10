import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreOffersPage } from "./StoreOffersPage";

const { getMock, postMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock,
    put: putMock,
    delete: deleteMock
  }
}));

function renderStoreOffers(initialEntries: InitialEntry[] = ["/store/offers"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/offers" element={<StoreOffersPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreOffersPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it("renders loading state", () => {
    getMock.mockReturnValue(new Promise(() => {})); // pending

    renderStoreOffers();

    expect(screen.getByTestId("offers-loading-skeleton")).toBeInTheDocument();
  });

  it("renders error state when API fails", async () => {
    getMock.mockRejectedValueOnce(new Error("Network Error"));

    renderStoreOffers();

    expect(await screen.findByText(/failed to load offers/i)).toBeInTheDocument();
  });

  it("renders empty state when there are no offers", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: []
      }
    });

    renderStoreOffers();

    expect(await screen.findByText(/no offers found/i)).toBeInTheDocument();
  });

  it("renders offers list with columns, checks action buttons visibility, and handles deactivation", async () => {
    const mockOffers = [
      {
        id: "offer-1",
        title: "Weekend Dairy Deal",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt: "2036-06-01T00:00:00.000Z",
        endsAt: "2036-06-10T00:00:00.000Z",
        isActive: true
      },
      {
        id: "offer-2",
        title: "Expired Grocery markdown",
        discountType: "FLAT",
        discountValue: 150,
        startsAt: "2036-06-11T00:00:00.000Z",
        endsAt: "2036-06-20T00:00:00.000Z",
        isActive: false
      }
    ];

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockOffers
      }
    });

    renderStoreOffers();

    // Verify headers & titles are rendered
    expect(await screen.findByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Discount")).toBeInTheDocument();
    expect(screen.getByText("Date Range")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();

    expect(screen.getByText("Weekend Dairy Deal")).toBeInTheDocument();
    expect(screen.getByText("Expired Grocery markdown")).toBeInTheDocument();

    // Verify Status Badge Text
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Deactivated")).toBeInTheDocument();

    // Verify Deactivate button for active, and missing for deactivated
    const deactivateBtnOffer1 = screen.getByTestId("deactivate-offer-offer-1");
    expect(deactivateBtnOffer1).toBeInTheDocument();
    expect(screen.queryByTestId("deactivate-offer-offer-2")).not.toBeInTheDocument();

    // Trigger Deactivation
    const user = userEvent.setup();
    putMock.mockResolvedValueOnce({
      data: {
        success: true
      }
    });

    // Mock next refetch after deactivate
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { ...mockOffers[0], isActive: false },
          mockOffers[1]
        ]
      }
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    await user.click(deactivateBtnOffer1);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/offers/offer-1/deactivate");
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "offers"] });
    });
  });

  it("handles form input validation and successful submission", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });

    renderStoreOffers();

    const user = userEvent.setup();

    // Fill form
    const titleInput = await screen.findByLabelText(/offer title/i);
    const typeSelect = screen.getByLabelText(/discount type/i);
    const valueInput = screen.getByLabelText(/discount value/i);
    const startsInput = screen.getByLabelText(/starts at/i);
    const endsInput = screen.getByLabelText(/ends at/i);
    const submitBtn = screen.getByRole("button", { name: /submit offer/i });

    await user.type(titleInput, "Monsoon Special");
    await user.selectOptions(typeSelect, "PERCENTAGE");
    await user.type(valueInput, "15");
    await user.clear(startsInput);
    await user.type(startsInput, "2026-07-01T00:00");
    await user.clear(endsInput);
    await user.type(endsInput, "2026-07-15T00:00");

    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "offer-new",
          title: "Monsoon Special",
          discountType: "PERCENTAGE",
          discountValue: 15,
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-07-15T00:00:00.000Z",
          isActive: true
        }
      }
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    await user.click(submitBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/store/offers", expect.objectContaining({
        title: "Monsoon Special",
        discountType: "PERCENTAGE",
        discountValue: 15
      }));
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "offers"] });
    });
  });

  it("renders edit and delete buttons, enters edit mode, and handles cancel", async () => {
    const mockOffers = [
      {
        id: "offer-1",
        title: "Weekend Dairy Deal",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt: "2036-06-01T00:00:00.000Z",
        endsAt: "2036-06-10T00:00:00.000Z",
        isActive: true
      }
    ];

    getMock.mockResolvedValueOnce({
      data: { success: true, data: mockOffers }
    });

    renderStoreOffers();

    // Verify presence of edit button
    const editBtn = await screen.findByTestId("edit-offer-offer-1");
    expect(editBtn).toBeInTheDocument();

    const user = userEvent.setup();

    // Click edit -> should enter edit mode and populate form fields
    await user.click(editBtn);

    expect(screen.getByRole("heading", { name: /edit offer/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/offer title/i)).toHaveValue("Weekend Dairy Deal");
    expect(screen.getByLabelText(/discount type/i)).toHaveValue("PERCENTAGE");
    expect(screen.getByLabelText(/discount value/i)).toHaveValue(10);

    // Active status checkbox should render only in edit mode
    const statusCheckbox = screen.getByLabelText(/active status/i);
    expect(statusCheckbox).toBeInTheDocument();
    expect(statusCheckbox).toBeChecked();

    // Click Cancel -> should restore default form
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(screen.getByRole("heading", { name: /create offer/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/active status/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/offer title/i)).toHaveValue("");
  });

  it("handles successful form submission in edit mode (PUT update and reactivation)", async () => {
    const mockOffers = [
      {
        id: "offer-1",
        title: "Weekend Dairy Deal",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt: "2036-06-01T00:00:00.000Z",
        endsAt: "2036-06-10T00:00:00.000Z",
        isActive: false // deactivated
      }
    ];

    getMock.mockResolvedValueOnce({
      data: { success: true, data: mockOffers }
    });

    renderStoreOffers();

    const editBtn = await screen.findByTestId("edit-offer-offer-1");
    const user = userEvent.setup();

    // Click edit -> populate form and active checkbox
    await user.click(editBtn);

    const titleInput = screen.getByLabelText(/offer title/i);
    const valueInput = screen.getByLabelText(/discount value/i);
    const statusCheckbox = screen.getByLabelText(/active status/i);
    const submitBtn = screen.getByRole("button", { name: /save changes/i });

    expect(statusCheckbox).not.toBeChecked();

    // Modify fields and reactivate
    await user.clear(titleInput);
    await user.type(titleInput, "Weekend Dairy Deal v2");
    await user.clear(valueInput);
    await user.type(valueInput, "15");
    await user.click(statusCheckbox); // Toggle active state to true

    expect(statusCheckbox).toBeChecked();

    putMock.mockResolvedValueOnce({
      data: { success: true }
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    await user.click(submitBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/offers/offer-1", expect.objectContaining({
        title: "Weekend Dairy Deal v2",
        discountValue: 15,
        isActive: true
      }));
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "offers"] });
    });
  });

});
