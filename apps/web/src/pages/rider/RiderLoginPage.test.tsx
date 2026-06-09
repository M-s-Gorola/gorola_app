/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RiderLoginPage } from "./RiderLoginPage";
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

function renderRiderLogin(initialEntries: InitialEntry[]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/rider/login" element={<RiderLoginPage />} />
          <Route path="/rider/dashboard" element={<div data-testid="rider-dashboard">Rider Dashboard</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("RiderLoginPage", () => {
  beforeEach(() => {
    postMock.mockReset();
    useAuthStore.getState().clearSession();
  });

  it("renders email input, password input and submit button with correct IDs", () => {
    renderRiderLogin(["/rider/login"]);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("id", "rider-email");
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("id", "rider-password");
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("shows validation error 'Email is required' on empty submit", async () => {
    const user = userEvent.setup();
    renderRiderLogin(["/rider/login"]);
    
    await user.click(screen.getByRole("button", { name: /login/i }));
    
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("navigates to /rider/dashboard on successful login", async () => {
    const user = userEvent.setup();
    
    // Mock successful login response with fake JWT
    // The fake JWT payload should have: sub: "rider-123", storeId: "store-456", role: "RIDER"
    const fakeToken = "header." + btoa(JSON.stringify({ sub: "rider-123", storeId: "store-456", role: "RIDER" })) + ".signature";
    
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          accessToken: fakeToken,
          refreshToken: "fake-refresh-token"
        }
      }
    });

    renderRiderLogin(["/rider/login"]);
    
    await user.type(screen.getByLabelText(/email/i), "rider@test.com");
    await user.type(screen.getByLabelText(/password/i), "correct_pass");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/rider/auth/login", {
        email: "rider@test.com",
        password: "correct_pass"
      });
    });

    expect(await screen.findByTestId("rider-dashboard")).toBeInTheDocument();
  });

  it("shows 'Invalid credentials' error message on 401 API response", async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          success: false,
          error: {
            code: "AUTH_FAILED",
            message: "Invalid credentials"
          }
        }
      }
    });

    renderRiderLogin(["/rider/login"]);
    
    await user.type(screen.getByLabelText(/email/i), "rider@test.com");
    await user.type(screen.getByLabelText(/password/i), "wrong_pass");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
