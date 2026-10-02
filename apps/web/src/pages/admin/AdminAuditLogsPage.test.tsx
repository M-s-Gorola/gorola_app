/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAuditLogsPage } from "./AdminAuditLogsPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string, config?: unknown) => getMock(url, config)),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id")
  }
}));

function renderAdminAuditLogs(initialEntries: InitialEntry[] = ["/admin/audit-logs"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminAuditLogsPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthStore.getState().setAdminSession({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      userId: "mock-admin-id",
      twoFactorVerified: true
    });
  });

  it("renders loader/skeleton state initially", () => {
    getMock.mockReturnValue(new Promise(() => {})); // remains loading

    renderAdminAuditLogs();

    expect(screen.getByTestId("audit-logs-loading-skeleton")).toBeInTheDocument();
  });

  it("renders audit logs table, handles expanding a row for JSON diff, and triggers CSV export", async () => {
    const mockLogsData = {
      success: true,
      data: {
        items: [
          {
            id: "log-1",
            actorId: "admin-1",
            actorRole: "ADMIN",
            actorMasked: "admin-masked@gorola.in",
            action: "ADMIN_USER_SUSPEND",
            entityType: "User",
            entityId: "user-1",
            oldValue: { isActive: true },
            newValue: { isActive: false },
            ipMasked: "192.168.***.***",
            createdAt: "2026-06-05T12:00:00.000Z"
          }
        ],
        nextCursor: null
      }
    };

    getMock.mockResolvedValueOnce({ data: mockLogsData });

    renderAdminAuditLogs();

    expect(await screen.findByText("Actor (masked)")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Entity")).toBeInTheDocument();
    expect(screen.getByText("IP (masked)")).toBeInTheDocument();

    // Verify row data
    expect(screen.getByText("admin-masked@gorola.in")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByText("ADMIN_USER_SUSPEND")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("192.168.***.***")).toBeInTheDocument();

    // Check that diff viewer is NOT visible initially
    expect(screen.queryByText(/Before/)).not.toBeInTheDocument();

    // Expand the row to show the diff
    const expandBtn = screen.getByTestId("expand-log-log-1");
    fireEvent.click(expandBtn);

    // Verify JSON diff is rendered
    expect(screen.getByText(/Before/)).toBeInTheDocument();
    expect(screen.getByText(/After/)).toBeInTheDocument();
    expect(screen.getByText(/"isActive": true/)).toBeInTheDocument();
    expect(screen.getByText(/"isActive": false/)).toBeInTheDocument();

    // Verify no edit or delete buttons exist on this page
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();

    // Trigger CSV export
    const exportBtn = screen.getByTestId("export-csv-button");
    getMock.mockResolvedValueOnce({ data: "Timestamp,Actor,Role,Action\n..." });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/admin/audit-logs/export"),
        expect.objectContaining({ responseType: "text" })
      );
    });
  });

  it("debounces action and entity search inputs before querying", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: { items: [], nextCursor: null }
      }
    });

    renderAdminAuditLogs();

    expect(await screen.findByText("Platform Audit Logs")).toBeInTheDocument();

    const actionInput = screen.getByPlaceholderText("Search action (e.g. SUSPEND)...");
    fireEvent.change(actionInput, { target: { value: "SUSPEND" } });

    // Should update input immediately
    expect((actionInput as HTMLInputElement).value).toBe("SUSPEND");

    // Debounce wait
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining("action=SUSPEND"),
        undefined
      );
    }, { timeout: 1500 });

    // Verify input remains mounted and keeps its value after API response resolves
    expect(screen.getByPlaceholderText("Search action (e.g. SUSPEND)...")).toBeInTheDocument();
    expect((screen.getByPlaceholderText("Search action (e.g. SUSPEND)...") as HTMLInputElement).value).toBe("SUSPEND");
  });

  it("retains input element mounting and focus during background refetches without replacing page", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: { items: [], nextCursor: null }
      }
    });

    renderAdminAuditLogs();

    const entityInput = screen.getByPlaceholderText("Search entity (e.g. Store)...");
    entityInput.focus();
    expect(document.activeElement).toBe(entityInput);

    fireEvent.change(entityInput, { target: { value: "ConsentLog" } });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining("entityType=ConsentLog"),
        undefined
      );
    }, { timeout: 1500 });

    // Ensure the input element was never unmounted or replaced
    expect(screen.getByPlaceholderText("Search entity (e.g. Store)...")).toBe(entityInput);
    expect((entityInput as HTMLInputElement).value).toBe("ConsentLog");
  });

  it("handles pagination navigation and page size selector changes", async () => {
    const mockPage1 = {
      success: true,
      data: {
        items: Array.from({ length: 10 }, (_, i) => ({
          id: `log-${i + 1}`,
          actorId: "admin-1",
          actorRole: "ADMIN" as const,
          actorMasked: "admin-masked@gorola.in",
          action: `ACTION_${i + 1}`,
          entityType: "User",
          entityId: `user-${i + 1}`,
          oldValue: null,
          newValue: null,
          ipMasked: "192.168.***.***",
          userAgent: "TestAgent",
          createdAt: "2026-10-02T12:00:00.000Z"
        })),
        nextCursor: "log-10"
      }
    };

    getMock.mockResolvedValueOnce({ data: mockPage1 });

    renderAdminAuditLogs();

    expect(await screen.findByText("Showing")).toBeInTheDocument();
    expect(screen.getByText("log entries")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(1);

    // Previous button should be disabled on page 1
    const prevBtn = screen.getByRole("button", { name: /Previous/i });
    expect(prevBtn).toBeDisabled();

    // Next button should be enabled because nextCursor is present
    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).not.toBeDisabled();

    // Click Next button to navigate to page 2
    const mockPage2 = {
      success: true,
      data: {
        items: [
          {
            id: "log-11",
            actorId: "admin-1",
            actorRole: "ADMIN" as const,
            actorMasked: "admin-masked@gorola.in",
            action: "ACTION_11",
            entityType: "User",
            entityId: "user-11",
            oldValue: null,
            newValue: null,
            ipMasked: "192.168.***.***",
            userAgent: "TestAgent",
            createdAt: "2026-10-02T12:00:00.000Z"
          }
        ],
        nextCursor: null
      }
    };

    getMock.mockResolvedValueOnce({ data: mockPage2 });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("Page 2")).toBeInTheDocument();
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining("cursor=log-10"),
        undefined
      );
    });

    // Test changing page size
    const pageSizeSelect = screen.getByTestId("page-size-select");
    fireEvent.change(pageSizeSelect, { target: { value: "50" } });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining("limit=50"),
        undefined
      );
    });
  });
});
