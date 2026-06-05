/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminFeatureFlagsPage } from "./AdminFeatureFlagsPage";
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

function renderAdminFeatureFlags(initialEntries: InitialEntry[] = ["/admin/feature-flags"]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/feature-flags" element={<AdminFeatureFlagsPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminFeatureFlagsPage", () => {
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

    renderAdminFeatureFlags();

    expect(screen.getByTestId("feature-flags-loading-skeleton")).toBeInTheDocument();
  });

  it("renders error message when API call fails", async () => {
    getMock.mockRejectedValueOnce(new Error("Network Error"));

    renderAdminFeatureFlags();

    expect(await screen.findByText(/failed to load feature flags/i)).toBeInTheDocument();
  });

  it("renders feature flags list, note text, and enables direct toggle for standard flags", async () => {
    const mockFeatureFlags = {
      success: true,
      data: [
        { key: "ANALYTICS_V2_ENABLED", value: false, description: "Enables new analytics charts", updatedAt: "2026-06-01T12:00:00.000Z" },
        { key: "WEATHER_MODE_ACTIVE", value: true, description: "Controls weather overlay", updatedAt: "2026-06-02T12:00:00.000Z" }
      ]
    };

    getMock.mockResolvedValueOnce({ data: mockFeatureFlags });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminFeatureFlags();

    // Page title and subtitle
    expect(await screen.findByText("Feature Flags")).toBeInTheDocument();
    expect(screen.getByText("Configure platform-wide capability controls and toggle system-wide flags.")).toBeInTheDocument();

    // Table rows
    expect(screen.getByText("ANALYTICS_V2_ENABLED")).toBeInTheDocument();
    expect(screen.getByText("Enables new analytics charts")).toBeInTheDocument();
    expect(screen.getByText("WEATHER_MODE_ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("Controls weather overlay")).toBeInTheDocument();

    // Invalidation note
    expect(screen.getByText(/Changes will propagate to Redis cache within 60s/i)).toBeInTheDocument();

    // Direct toggle on non-high-impact flag (ANALYTICS_V2_ENABLED)
    const toggleButton = screen.getByRole("switch", { name: /toggle flag ANALYTICS_V2_ENABLED/i });
    expect(toggleButton).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggleButton);

    // No modal should be present for ANALYTICS_V2_ENABLED
    expect(screen.queryByText("Confirm Feature Flag Update")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/feature-flags/ANALYTICS_V2_ENABLED", { value: true });
    });
  });

  it("triggers confirmation modal for high-impact flag WEATHER_MODE_ACTIVE and calls PUT on confirm", async () => {
    const mockFeatureFlags = {
      success: true,
      data: [
        { key: "WEATHER_MODE_ACTIVE", value: false, description: "Controls weather overlay", updatedAt: "2026-06-02T12:00:00.000Z" }
      ]
    };

    getMock.mockResolvedValue({ data: mockFeatureFlags });
    putMock.mockResolvedValueOnce({ data: { success: true } });

    renderAdminFeatureFlags();

    expect(await screen.findByText("WEATHER_MODE_ACTIVE")).toBeInTheDocument();

    const toggleButton = screen.getByRole("switch", { name: /toggle flag WEATHER_MODE_ACTIVE/i });
    fireEvent.click(toggleButton);

    // Confirmation modal should show warnings
    expect(screen.getByText("Confirm Feature Flag Update")).toBeInTheDocument();
    expect(screen.getByText(/Activating Weather Mode has high system impact/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Confirm Update" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/v1/admin/feature-flags/WEATHER_MODE_ACTIVE", { value: true });
    });
  });
});
