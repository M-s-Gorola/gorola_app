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

    expect(await screen.findByText("Platform Audit Logs")).toBeInTheDocument();

    // Verify headers
    expect(screen.getByText("Actor (masked)")).toBeInTheDocument();
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
});
