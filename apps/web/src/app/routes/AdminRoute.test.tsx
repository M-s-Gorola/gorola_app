import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AdminRoute } from "@/app/routes/guards";
import { useAuthStore } from "@/store/auth.store";

function SecretPage() {
  return <h1>Admin Secret Content</h1>;
}

describe("AdminRoute Guard", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      isBootstrapPending: false,
      refreshToken: null,
      role: null,
      twoFactorVerified: null,
      twoFactorEnabled: null
    });
  });

  it("redirects to /admin/login when role is not ADMIN (non-ADMIN role)", () => {
    useAuthStore.setState({
      accessToken: "token",
      role: "BUYER"
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route path="/admin/login" element={<h1>Admin Login Page</h1>} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <SecretPage />
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Admin Login Page" })).toBeInTheDocument();
  });

  it("redirects to /admin/2fa when ADMIN role with twoFactorVerified = false", () => {
    useAuthStore.setState({
      accessToken: "token",
      role: "ADMIN",
      twoFactorVerified: false,
      twoFactorEnabled: true
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route path="/admin/2fa" element={<h1>Admin 2FA Page</h1>} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <SecretPage />
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Admin 2FA Page" })).toBeInTheDocument();
  });

  it("redirects to /admin/setup-2fa when ADMIN role with twoFactorVerified = true and twoFactorEnabled = false", () => {
    useAuthStore.setState({
      accessToken: "token",
      role: "ADMIN",
      twoFactorVerified: true,
      twoFactorEnabled: false
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route path="/admin/setup-2fa" element={<h1>Admin Setup 2FA Page</h1>} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <SecretPage />
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Admin Setup 2FA Page" })).toBeInTheDocument();
  });

  it("renders children when ADMIN, twoFactorVerified = true and twoFactorEnabled = true", () => {
    useAuthStore.setState({
      accessToken: "token",
      role: "ADMIN",
      twoFactorVerified: true,
      twoFactorEnabled: true
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <SecretPage />
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Admin Secret Content" })).toBeInTheDocument();
  });
});
