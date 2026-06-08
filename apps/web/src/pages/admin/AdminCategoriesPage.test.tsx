/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { utils } from "xlsx";

import { AdminCategoriesPage } from "./AdminCategoriesPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string) => getMock(url)),
    post: vi.fn((url: string, body: unknown) => postMock(url, body)),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock("xlsx", () => ({
  read: vi.fn().mockReturnValue({
    SheetNames: ["Sheet1"],
    Sheets: {
      Sheet1: {}
    }
  }),
  utils: {
    sheet_to_json: vi.fn()
  }
}));

function renderAdminCategories(initialEntries: InitialEntry[] = ["/admin/categories"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminCategoriesPage Bulk Import Integration", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    vi.mocked(utils.sheet_to_json).mockReset();

    useAuthStore.getState().setAdminSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-admin-id",
      twoFactorVerified: true
    });

    // Default categories fetch response
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: []
      }
    });
  });

  it("should render the 'Import Categories' button", async () => {
    renderAdminCategories();

    const btn = await screen.findByTestId("import-categories-btn");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/import categories/i);
  });

  it("should open bulk import modal on click and display correct components", async () => {
    renderAdminCategories();

    const btn = await screen.findByTestId("import-categories-btn");
    fireEvent.click(btn);

    const modal = await screen.findByTestId("bulk-import-modal");
    expect(modal).toBeInTheDocument();

    expect(screen.getByText(/download sample/i)).toBeInTheDocument();
    expect(screen.getByTestId("bulk-file-input")).toBeInTheDocument();

    const validateBtn = screen.getByRole("button", { name: /validate/i });
    expect(validateBtn).toBeDisabled();
  });

  it("should enable validate button after selecting a file", async () => {
    renderAdminCategories();

    fireEvent.click(await screen.findByTestId("import-categories-btn"));

    const fileInput = screen.getByTestId("bulk-file-input");
    const file = new File(["dummy content"], "categories.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    // Mock sheet parsing returning rows
    vi.mocked(utils.sheet_to_json).mockReturnValue([
      {
        "Category Name": "Beverages",
        "SubCategory Name": "Soft Drinks",
        "Commerce Type": "QUICK_COMMERCE",
        "Display Order": 1
      }
    ]);

    await userEvent.upload(fileInput, file);

    const validateBtn = screen.getByRole("button", { name: /validate/i });
    await waitFor(() => expect(validateBtn).toBeEnabled());
  });

  it("should display success banner and confirm button when validation succeeds", async () => {
    renderAdminCategories();

    fireEvent.click(await screen.findByTestId("import-categories-btn"));

    const fileInput = screen.getByTestId("bulk-file-input");
    const file = new File(["dummy content"], "categories.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    vi.mocked(utils.sheet_to_json).mockReturnValue([
      {
        "Category Name": "Beverages",
        "SubCategory Name": "Soft Drinks"
      }
    ]);

    await userEvent.upload(fileInput, file);

    // Mock validate endpoint returning valid
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          valid: true,
          conflicts: [],
          totalRows: 1,
          totalSubCategoryRows: 1
        }
      }
    });

    // Mock confirm endpoint
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          inserted: 1,
          skipped: 0,
          insertedNames: ["Beverages"],
          skippedNames: []
        }
      }
    });

    const validateBtn = screen.getByRole("button", { name: /validate/i });
    await waitFor(() => expect(validateBtn).toBeEnabled());
    fireEvent.click(validateBtn);

    const successBanner = await screen.findByTestId("bulk-validation-success");
    expect(successBanner).toBeInTheDocument();
    expect(successBanner).toHaveTextContent(/all rows are valid/i);

    const confirmBtn = screen.getByRole("button", { name: /confirm & import/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/admin/bulk/categories/confirm?mode=strict", {
        rows: [
          {
            name: "Beverages",
            subCategories: [{ name: "Soft Drinks" }],
            commerceType: "QUICK_COMMERCE",
            displayOrder: undefined
          }
        ]
      });
    });
  });

  it("should display conflict table when validation fails", async () => {
    renderAdminCategories();

    fireEvent.click(await screen.findByTestId("import-categories-btn"));

    const fileInput = screen.getByTestId("bulk-file-input");
    const file = new File(["dummy content"], "categories.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    vi.mocked(utils.sheet_to_json).mockReturnValue([
      {
        "Category Name": "Dairy",
        "SubCategory Name": "Milk"
      }
    ]);

    await userEvent.upload(fileInput, file);

    // Mock validate returning conflict
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          valid: false,
          conflicts: [
            {
              row: 1,
              type: "CATEGORY_SLUG_EXISTS",
              name: "Dairy",
              slug: "dairy"
            }
          ],
          totalRows: 1,
          totalSubCategoryRows: 1
        }
      }
    });

    const validateBtn = screen.getByRole("button", { name: /validate/i });
    await waitFor(() => expect(validateBtn).toBeEnabled());
    fireEvent.click(validateBtn);

    const conflictTable = await screen.findByTestId("bulk-conflict-table");
    expect(conflictTable).toBeInTheDocument();
    expect(screen.getByText(/row 1/i)).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Dairy" })).toBeInTheDocument();
    expect(screen.getByText(/category slug already exists/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /fix my file/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip conflicts & continue/i })).toBeInTheDocument();
  });

  it("should trigger confirm?mode=skip when clicking 'Skip conflicts & continue'", async () => {
    renderAdminCategories();

    fireEvent.click(await screen.findByTestId("import-categories-btn"));

    const fileInput = screen.getByTestId("bulk-file-input");
    const file = new File(["dummy content"], "categories.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    vi.mocked(utils.sheet_to_json).mockReturnValue([
      {
        "Category Name": "Dairy",
        "SubCategory Name": "Milk"
      }
    ]);

    await userEvent.upload(fileInput, file);

    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          valid: false,
          conflicts: [
            {
              row: 1,
              type: "CATEGORY_SLUG_EXISTS",
              name: "Dairy",
              slug: "dairy"
            }
          ],
          totalRows: 1,
          totalSubCategoryRows: 1
        }
      }
    });

    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          inserted: 0,
          skipped: 1,
          insertedNames: [],
          skippedNames: ["Dairy"]
        }
      }
    });

    const validateBtn = screen.getByRole("button", { name: /validate/i });
    await waitFor(() => expect(validateBtn).toBeEnabled());
    fireEvent.click(validateBtn);

    const skipBtn = await screen.findByRole("button", { name: /skip conflicts & continue/i });
    fireEvent.click(skipBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/admin/bulk/categories/confirm?mode=skip", {
        rows: [
          {
            name: "Dairy",
            subCategories: [{ name: "Milk" }],
            commerceType: "QUICK_COMMERCE",
            displayOrder: undefined
          }
        ]
      });
    });
  });

  it("should close the modal without confirming when clicking 'Fix my file'", async () => {
    renderAdminCategories();

    fireEvent.click(await screen.findByTestId("import-categories-btn"));

    const fileInput = screen.getByTestId("bulk-file-input");
    const file = new File(["dummy content"], "categories.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    vi.mocked(utils.sheet_to_json).mockReturnValue([
      {
        "Category Name": "Dairy",
        "SubCategory Name": "Milk"
      }
    ]);

    await userEvent.upload(fileInput, file);

    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          valid: false,
          conflicts: [
            {
              row: 1,
              type: "CATEGORY_SLUG_EXISTS",
              name: "Dairy",
              slug: "dairy"
            }
          ],
          totalRows: 1,
          totalSubCategoryRows: 1
        }
      }
    });

    const validateBtn = screen.getByRole("button", { name: /validate/i });
    await waitFor(() => expect(validateBtn).toBeEnabled());
    fireEvent.click(validateBtn);

    const fixBtn = await screen.findByRole("button", { name: /fix my file/i });
    fireEvent.click(fixBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("bulk-import-modal")).not.toBeInTheDocument();
    });
    expect(postMock).not.toHaveBeenCalledWith(expect.stringContaining("confirm"), expect.any(Object));
  });
});
