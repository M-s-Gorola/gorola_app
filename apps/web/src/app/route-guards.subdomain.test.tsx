import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRoute, StoreRoute } from "@/app/routes/guards";
import { useAuthStore } from "@/store/auth.store";

describe("subdomain route guards", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      isBootstrapPending: false,
      refreshToken: null,
      role: null,
      twoFactorVerified: false
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true
    });
  });

  const setHostnameAndPath = (hostname: string, pathname: string) => {
    Object.defineProperty(window, "location", {
      value: {
        hostname,
        pathname,
        href: `http://${hostname}${pathname}`,
        origin: `http://${hostname}`,
        assign: vi.fn(),
        replace: vi.fn()
      },
      writable: true,
      configurable: true
    });
  };

  it("redirects to /2fa instead of /store/2fa under store.gorola.com when 2FA is unverified", () => {
    setHostnameAndPath("store.gorola.com", "/dashboard");
    useAuthStore.setState({
      accessToken: "mock-access-token",
      role: "STORE_OWNER",
      twoFactorVerified: false
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/2fa" element={<h1>Subdomain 2FA Form</h1>} />
          <Route path="/store/2fa" element={<h1>Path-prefixed 2FA Form</h1>} />
          <Route
            path="/dashboard"
            element={
              <StoreRoute>
                <h1>Store Dashboard</h1>
              </StoreRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Subdomain 2FA Form" })).toBeInTheDocument();
  });

  it("redirects to /store/2fa under localhost when 2FA is unverified", () => {
    setHostnameAndPath("localhost", "/store/dashboard");
    useAuthStore.setState({
      accessToken: "mock-access-token",
      role: "STORE_OWNER",
      twoFactorVerified: false
    });

    render(
      <MemoryRouter initialEntries={["/store/dashboard"]}>
        <Routes>
          <Route path="/2fa" element={<h1>Subdomain 2FA Form</h1>} />
          <Route path="/store/2fa" element={<h1>Path-prefixed 2FA Form</h1>} />
          <Route
            path="/store/dashboard"
            element={
              <StoreRoute>
                <h1>Store Dashboard</h1>
              </StoreRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Path-prefixed 2FA Form" })).toBeInTheDocument();
  });

  it("redirects to /login instead of a namespaced admin login under admin.gorola.com for unauthenticated user", () => {
    setHostnameAndPath("admin.gorola.com", "/dashboard");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<h1>Buyer Login Form</h1>} />
          <Route path="/admin/login" element={<h1>Admin Login Form</h1>} />
          <Route
            path="/dashboard"
            element={
              <AdminRoute>
                <h1>Admin Dashboard</h1>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Buyer Login Form" })).toBeInTheDocument();
  });
});
