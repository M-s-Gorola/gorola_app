/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreLoginPage } from "./StoreLoginPage";
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

function renderStoreLogin(initialEntries: InitialEntry[]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/login" element={<StoreLoginPage />} />
          <Route path="/store/2fa" element={<div data-testid="store-2fa">Store 2FA</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreLoginPage", () => {
  beforeEach(() => {
    postMock.mockReset();
    useAuthStore.getState().clearSession();
  });

  it("renders email input, password input and submit button with correct IDs", () => {
    renderStoreLogin(["/store/login"]);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("id", "store-login-email");
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("id", "store-login-password");
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("shows validation error 'Email is required' on empty submit", async () => {
    const user = userEvent.setup();
    renderStoreLogin(["/store/login"]);
    
    await user.click(screen.getByRole("button", { name: /login/i }));
    
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("navigates to /store/2fa on successful login returning requiresTwoFactor", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValueOnce({
      data: { success: true, data: { requiresTwoFactor: true } }
    });

    renderStoreLogin(["/store/login"]);
    
    await user.type(screen.getByLabelText(/email/i), "owner@store.com");
    await user.type(screen.getByLabelText(/password/i), "Password#123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/store-owner/login", {
        email: "owner@store.com",
        password: "Password#123"
      });
    });

    expect(await screen.findByTestId("store-2fa")).toBeInTheDocument();
  });

  it("shows 'Invalid credentials' error message on 401 API response", async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid credentials"
          }
        }
      }
    });

    renderStoreLogin(["/store/login"]);
    
    await user.type(screen.getByLabelText(/email/i), "owner@store.com");
    await user.type(screen.getByLabelText(/password/i), "WrongPassword");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
