import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";

import { StoreLayout } from "./StoreLayout";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

let mockApi: { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> } | null = {
  post: vi.fn().mockResolvedValue({}),
  get: getMock
};

vi.mock("@/lib/api", () => {
  return {
    get api() {
      return mockApi;
    }
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false }
    }
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreLayout Logout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    getMock.mockReset();
    sessionStorage.clear();

    // Default: profile fetch returns QUICK_COMMERCE (Bookings nav hidden)
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: { id: "store-123", name: "Test Store", storeType: "QUICK_COMMERCE" }
      }
    });

    mockApi = {
      post: vi.fn().mockResolvedValue({}),
      get: getMock
    };

    useAuthStore.setState({
      accessToken: "at",
      refreshToken: "rt-token",
      role: "STORE_OWNER",
      twoFactorVerified: true,
      storeId: "store-123"
    });
  });

  it("clears sessionStorage override and navigates correctly on logout", async () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");
    const user = userEvent.setup();

    renderWithProviders(
      <StoreLayout>
        <div>Dashboard Content</div>
      </StoreLayout>
    );

    // There are two Logout buttons: one sidebar (desktop) and one header (mobile).
    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    expect(removeItemSpy).toHaveBeenCalledWith("gorola_subdomain_override");
  });

  it("navigates to /store/login on logout when isSubdomainMode is false", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <StoreLayout>
        <div>Dashboard Content</div>
      </StoreLayout>
    );

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    expect(mockNavigate).toHaveBeenCalledWith("/store/login");
  });

  it("navigates to /login on logout when isSubdomainMode is true (via subdomain hostname)", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: new URL("http://store.gorola.com"),
      configurable: true,
      writable: true
    });

    const user = userEvent.setup();

    renderWithProviders(
      <StoreLayout>
        <div>Dashboard Content</div>
      </StoreLayout>
    );

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    expect(mockNavigate).toHaveBeenCalledWith("/login");

    Object.defineProperty(window, "location", {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it("calls api.post with correct endpoint and refreshToken on logout", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <StoreLayout>
        <div>Dashboard Content</div>
      </StoreLayout>
    );

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    expect(mockApi!.post).toHaveBeenCalledWith("/api/v1/auth/store-owner/logout", {
      refreshToken: "rt-token"
    });
  });

  it("resiliently logouts client-side even when api.post rejects (fire-and-forget)", async () => {
    mockApi!.post.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();

    renderWithProviders(
      <StoreLayout>
        <div>Dashboard Content</div>
      </StoreLayout>
    );

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    expect(mockApi!.post).toHaveBeenCalledWith("/api/v1/auth/store-owner/logout", {
      refreshToken: "rt-token"
    });

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();

    expect(mockNavigate).toHaveBeenCalledWith("/store/login");
  });

  it("resiliently logouts when api is null", async () => {
    mockApi = null;
    const user = userEvent.setup();

    renderWithProviders(
      <StoreLayout>
        <div>Dashboard Content</div>
      </StoreLayout>
    );

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();

    expect(mockNavigate).toHaveBeenCalledWith("/store/login");
  });
});
