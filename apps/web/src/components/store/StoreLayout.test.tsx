import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

let mockApi: { post: ReturnType<typeof vi.fn> } | null = {
  post: vi.fn().mockResolvedValue({})
};

vi.mock("@/lib/api", () => {
  return {
    get api() {
      return mockApi;
    }
  };
});

describe("StoreLayout Logout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    sessionStorage.clear();
    mockApi = {
      post: vi.fn().mockResolvedValue({})
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

    render(
      <MemoryRouter>
        <StoreLayout>
          <div>Dashboard Content</div>
        </StoreLayout>
      </MemoryRouter>
    );

    // There are two Logout buttons: one sidebar (desktop) and one header (mobile).
    // Let's click the desktop sidebar one.
    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    // sessionStorage.removeItem should be called at least once
    expect(removeItemSpy).toHaveBeenCalledWith("gorola_subdomain_override");
  });

  it("navigates to /store/login on logout when isSubdomainMode is false", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <StoreLayout>
          <div>Dashboard Content</div>
        </StoreLayout>
      </MemoryRouter>
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

    render(
      <MemoryRouter>
        <StoreLayout>
          <div>Dashboard Content</div>
        </StoreLayout>
      </MemoryRouter>
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

    render(
      <MemoryRouter>
        <StoreLayout>
          <div>Dashboard Content</div>
        </StoreLayout>
      </MemoryRouter>
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

    render(
      <MemoryRouter>
        <StoreLayout>
          <div>Dashboard Content</div>
        </StoreLayout>
      </MemoryRouter>
    );

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    // Check that api.post was called
    expect(mockApi!.post).toHaveBeenCalledWith("/api/v1/auth/store-owner/logout", {
      refreshToken: "rt-token"
    });

    // Check that clearSession was still called successfully
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();

    // Check that navigation still occurred
    expect(mockNavigate).toHaveBeenCalledWith("/store/login");
  });

  it("resiliently logouts when api is null", async () => {
    mockApi = null;
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <StoreLayout>
          <div>Dashboard Content</div>
        </StoreLayout>
      </MemoryRouter>
    );

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButtons[0]!);

    // Check that clearSession was still called successfully
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();

    // Check that navigation still occurred
    expect(mockNavigate).toHaveBeenCalledWith("/store/login");
  });
});
