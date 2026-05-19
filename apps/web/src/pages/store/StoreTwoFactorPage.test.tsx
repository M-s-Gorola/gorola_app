/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreTwoFactorPage } from "./StoreTwoFactorPage";
import { useAuthStore } from "@/store/auth.store";

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: postMock
  }
}));

function renderStoreTwoFactor(initialEntries: InitialEntry[]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/2fa" element={<StoreTwoFactorPage />} />
          <Route path="/store/dashboard" element={<div data-testid="store-dashboard">Store Dashboard</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreTwoFactorPage", () => {
  beforeEach(() => {
    postMock.mockReset();
    useAuthStore.getState().clearSession();
  });

  it("renders 6-digit OTP input with id='totp-input' and 'Verify' button", () => {
    renderStoreTwoFactor([
      { pathname: "/store/2fa", state: { email: "owner@store.com", password: "Password#123" } }
    ]);
    expect(screen.getByLabelText(/two-factor code/i)).toHaveAttribute("id", "totp-input");
    expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
  });

  it("submitting with less than 6 digits shows error 'Code must be 6 digits'", async () => {
    const user = userEvent.setup();
    renderStoreTwoFactor([
      { pathname: "/store/2fa", state: { email: "owner@store.com", password: "Password#123" } }
    ]);

    await user.type(screen.getByLabelText(/two-factor code/i), "12345");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/code must be 6 digits/i)).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("on successful verification, sets tokens and navigates to /store/dashboard", async () => {
    const user = userEvent.setup();
    const mockJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJvd25lci1pZCIsInN0b3JlSWQiOiJzdG9yZS1pZCIsInJvbGUiOiJTVE9SRV9PV05FUiJ9.signature";
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          accessToken: mockJwt,
          refreshToken: "store-refresh-token",
          userId: "owner-id",
          storeId: "store-id"
        }
      }
    });

    renderStoreTwoFactor([
      { pathname: "/store/2fa", state: { email: "owner@store.com", password: "Password#123" } }
    ]);

    await user.type(screen.getByLabelText(/two-factor code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/store-owner/login", {
        email: "owner@store.com",
        password: "Password#123",
        totpCode: "123456"
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("store-dashboard")).toBeInTheDocument();
    });

    expect(useAuthStore.getState().accessToken).toBe(mockJwt);
    expect(useAuthStore.getState().refreshToken).toBe("store-refresh-token");
    expect(useAuthStore.getState().role).toBe("STORE_OWNER");
    expect(useAuthStore.getState().userId).toBe("owner-id");
    expect(useAuthStore.getState().storeId).toBe("store-id");
  });

  it("on invalid code, shows 'Invalid TOTP code'", async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid TOTP code"
          }
        }
      }
    });

    renderStoreTwoFactor([
      { pathname: "/store/2fa", state: { email: "owner@store.com", password: "Password#123" } }
    ]);

    await user.type(screen.getByLabelText(/two-factor code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/invalid totp code/i)).toBeInTheDocument();
  });
});
