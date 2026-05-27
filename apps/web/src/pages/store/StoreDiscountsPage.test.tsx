import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreDiscountsPage } from "./StoreDiscountsPage";

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

function renderStoreDiscounts(initialEntries: InitialEntry[] = ["/store/discounts"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/discounts" element={<StoreDiscountsPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreDiscountsPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it("renders loading skeleton initially", () => {
    // Keep it pending
    getMock.mockImplementation(() => new Promise(() => {}));

    renderStoreDiscounts();

    expect(screen.getByTestId("discounts-loading-skeleton")).toBeInTheDocument();
  });

  it("renders error state when API fails", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { storeType: "QUICK_COMMERCE" }
          }
        });
      }
      return Promise.reject(new Error("Network Error"));
    });

    renderStoreDiscounts();

    expect(await screen.findByText(/failed to load discounts/i)).toBeInTheDocument();
  });

  it("renders discount list and handles deactivation", async () => {
    const mockDiscounts = [
      {
        id: "discount-1",
        code: "SAVE10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        usedCount: 5,
        maxUsageCount: 100,
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-06-10T00:00:00.000Z",
        isActive: true
      },
      {
        id: "discount-2",
        code: "FLAT50",
        discountType: "FLAT",
        discountValue: 50,
        usedCount: 10,
        maxUsageCount: 10,
        startsAt: "2026-06-11T00:00:00.000Z",
        endsAt: "2026-06-20T00:00:00.000Z",
        isActive: false
      }
    ];

    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { storeType: "QUICK_COMMERCE" }
          }
        });
      }
      if (url.includes("/discounts")) {
        return Promise.resolve({
          data: {
            success: true,
            data: mockDiscounts
          }
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderStoreDiscounts();

    // Verify headers & titles are rendered
    expect(await screen.findByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Used / Max")).toBeInTheDocument();
    expect(screen.getByText("Valid Until")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();

    expect(screen.getByText("SAVE10")).toBeInTheDocument();
    expect(screen.getByText("FLAT50")).toBeInTheDocument();

    // Verify usage values
    expect(screen.getByText("5 / 100")).toBeInTheDocument();
    expect(screen.getByText("10 / 10")).toBeInTheDocument();

    // Verify Status Badge Text
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Deactivated")).toBeInTheDocument();

    // Verify Deactivate button for active, and missing for deactivated
    const deactivateBtn1 = screen.getByTestId("deactivate-discount-discount-1");
    expect(deactivateBtn1).toBeInTheDocument();
    expect(screen.queryByTestId("deactivate-discount-discount-2")).not.toBeInTheDocument();

    // Trigger Deactivation
    const user = userEvent.setup();
    putMock.mockResolvedValueOnce({
      data: { success: true }
    });

    // Change mock response for next query calls
    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { storeType: "QUICK_COMMERCE" }
          }
        });
      }
      if (url.includes("/discounts")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { ...mockDiscounts[0], isActive: false },
              mockDiscounts[1]
            ]
          }
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    await user.click(deactivateBtn1);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/discounts/discount-1/deactivate");
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "discounts"] });
    });
  });

  it("handles form inputs (automatically converting code to uppercase) and successful submission", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { storeType: "QUICK_COMMERCE" }
          }
        });
      }
      if (url.includes("/discounts")) {
        return Promise.resolve({
          data: {
            success: true,
            data: []
          }
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderStoreDiscounts();

    const user = userEvent.setup();

    const codeInput = await screen.findByLabelText(/discount code/i);
    const typeSelect = screen.getByLabelText(/discount type/i);
    const valueInput = screen.getByLabelText(/discount value/i);
    const maxUsageInput = screen.getByLabelText(/max usage limit/i);
    const startsInput = screen.getByLabelText(/starts at/i);
    const endsInput = screen.getByLabelText(/ends at/i);
    const submitBtn = screen.getByRole("button", { name: /create discount code/i });

    // Verify lowercase automatically becomes uppercase
    await user.type(codeInput, "save100");
    expect(codeInput).toHaveValue("SAVE100");

    await user.selectOptions(typeSelect, "PERCENTAGE");
    await user.type(valueInput, "20");
    await user.type(maxUsageInput, "50");
    await user.clear(startsInput);
    await user.type(startsInput, "2026-06-01T00:00");
    await user.clear(endsInput);
    await user.type(endsInput, "2026-06-10T00:00");

    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "discount-new",
          code: "SAVE100",
          discountType: "PERCENTAGE",
          discountValue: 20,
          usedCount: 0,
          maxUsageCount: 50,
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: "2026-06-10T00:00:00.000Z",
          isActive: true
        }
      }
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    await user.click(submitBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/store/discounts", expect.objectContaining({
        code: "SAVE100",
        discountType: "PERCENTAGE",
        discountValue: 20,
        maxUsageCount: 50
      }));
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "discounts"] });
    });
  });

  it("dynamically shows correct labels for QUICK_COMMERCE store", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { storeType: "QUICK_COMMERCE" }
          }
        });
      }
      if (url.includes("/discounts")) {
        return Promise.resolve({
          data: {
            success: true,
            data: []
          }
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderStoreDiscounts();

    // In QUICK_COMMERCE, we expect cart/order specific instructions
    expect(await screen.findByText(/applied in the cart drawer during checkout/i)).toBeInTheDocument();
  });

  it("dynamically shows correct labels for BOOKING_COMMERCE store", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { storeType: "BOOKING_COMMERCE" }
          }
        });
      }
      if (url.includes("/discounts")) {
        return Promise.resolve({
          data: {
            success: true,
            data: []
          }
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderStoreDiscounts();

    // In BOOKING_COMMERCE, we expect service/appointment specific instructions
    expect(await screen.findByText(/applied during booking checkout for services/i)).toBeInTheDocument();
  });

  it("renders edit and delete buttons, enters edit mode, and handles cancel", async () => {
    const mockDiscounts = [
      {
        id: "discount-1",
        code: "SAVE10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        usedCount: 5,
        maxUsageCount: 100,
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-06-10T00:00:00.000Z",
        isActive: true
      }
    ];

    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: { success: true, data: { storeType: "QUICK_COMMERCE" } }
        });
      }
      if (url.includes("/discounts")) {
        return Promise.resolve({
          data: { success: true, data: mockDiscounts }
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderStoreDiscounts();

    // Verify presence of edit button
    const editBtn = await screen.findByTestId("edit-discount-discount-1");
    expect(editBtn).toBeInTheDocument();

    const user = userEvent.setup();

    // Click edit -> should enter edit mode and populate form fields
    await user.click(editBtn);

    expect(screen.getByRole("heading", { name: /edit discount code/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/discount code/i)).toHaveValue("SAVE10");
    expect(screen.getByLabelText(/discount type/i)).toHaveValue("PERCENTAGE");
    expect(screen.getByLabelText(/discount value/i)).toHaveValue(10);
    expect(screen.getByLabelText(/max usage limit/i)).toHaveValue(100);

    // Active status checkbox should render only in edit mode
    const statusCheckbox = screen.getByLabelText(/active status/i);
    expect(statusCheckbox).toBeInTheDocument();
    expect(statusCheckbox).toBeChecked();

    // Click Cancel -> should restore default form
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(screen.getByRole("heading", { name: /create code/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/active status/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/discount code/i)).toHaveValue("");
  });

  it("handles successful form submission in edit mode (PUT update and reactivation)", async () => {
    const mockDiscounts = [
      {
        id: "discount-1",
        code: "SAVE10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        usedCount: 5,
        maxUsageCount: 100,
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-06-10T00:00:00.000Z",
        isActive: false // deactivated
      }
    ];

    getMock.mockImplementation((url: string) => {
      if (url.includes("/profile")) {
        return Promise.resolve({
          data: { success: true, data: { storeType: "QUICK_COMMERCE" } }
        });
      }
      if (url.includes("/discounts")) {
        return Promise.resolve({
          data: { success: true, data: mockDiscounts }
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderStoreDiscounts();

    const editBtn = await screen.findByTestId("edit-discount-discount-1");
    const user = userEvent.setup();

    // Click edit -> populate form and active checkbox
    await user.click(editBtn);

    const codeInput = screen.getByLabelText(/discount code/i);
    const valueInput = screen.getByLabelText(/discount value/i);
    const statusCheckbox = screen.getByLabelText(/active status/i);
    const submitBtn = screen.getByRole("button", { name: /save changes/i });

    expect(statusCheckbox).not.toBeChecked();

    // Modify fields and reactivate
    await user.clear(codeInput);
    await user.type(codeInput, "save15");
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
      expect(putMock).toHaveBeenCalledWith("/api/v1/store/discounts/discount-1", expect.objectContaining({
        code: "SAVE15",
        discountValue: 15,
        isActive: true
      }));
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "discounts"] });
    });
  });
});
