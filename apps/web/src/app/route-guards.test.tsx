import { render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AdminRoute, ProtectedRoute, StoreRoute } from "@/app/routes/guards";
import { useAuthStore } from "@/store/auth.store";

function LoginPage() {
  return <h1>Login Page</h1>;
}

function SecretPage() {
  return <h1>Protected Content</h1>;
}

describe("route guards", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      isBootstrapPending: false,
      refreshToken: null,
      role: null
    });
  });

  it("redirects to /login for unauthenticated protected routes", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <SecretPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Login Page" })).toBeInTheDocument();
  });

  it("redirects to /store/login for unauthenticated store owner routes", () => {
    render(
      <MemoryRouter initialEntries={["/store"]}>
        <Routes>
          <Route path="/store/login" element={<h1>Store Login Page</h1>} />
          <Route
            path="/store"
            element={
              <StoreRoute>
                <SecretPage />
              </StoreRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Store Login Page" })).toBeInTheDocument();
  });

  it("redirects to /store/2fa for authenticated STORE_OWNER who is not twoFactorVerified", () => {
    useAuthStore.setState({
      accessToken: "a",
      isBootstrapPending: false,
      refreshToken: "r",
      role: "STORE_OWNER",
      twoFactorVerified: false
    });
    render(
      <MemoryRouter initialEntries={["/store"]}>
        <Routes>
          <Route path="/store/2fa" element={<h1>Store 2FA Page</h1>} />
          <Route
            path="/store"
            element={
              <StoreRoute>
                <SecretPage />
              </StoreRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Store 2FA Page" })).toBeInTheDocument();
  });

  it("allows STORE_OWNER when role is STORE_OWNER and twoFactorVerified is true", () => {
    useAuthStore.setState({
      accessToken: "a",
      isBootstrapPending: false,
      refreshToken: "r",
      role: "STORE_OWNER",
      twoFactorVerified: true
    });
    render(
      <MemoryRouter initialEntries={["/store"]}>
        <Routes>
          <Route
            path="/store"
            element={
              <StoreRoute>
                <SecretPage />
              </StoreRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Protected Content" })).toBeInTheDocument();
  });

  it("allows ADMIN route when role is ADMIN", () => {
    useAuthStore.setState({ accessToken: "a", isBootstrapPending: false, refreshToken: "r", role: "ADMIN" });
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <SecretPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Protected Content" })).toBeInTheDocument();
  });
});
