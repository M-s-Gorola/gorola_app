import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { RiderRoute } from "@/app/routes/guards";
import { useAuthStore } from "@/store/auth.store";

function SecretPage() {
  return <h1>Rider Secret Content</h1>;
}

describe("RiderRoute Guard", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      isBootstrapPending: false,
      refreshToken: null,
      role: null,
      storeId: null
    });
  });

  it("redirects to /rider/login when role is not RIDER", () => {
    useAuthStore.setState({
      accessToken: "token",
      role: "BUYER"
    });

    render(
      <MemoryRouter initialEntries={["/rider/dashboard"]}>
        <Routes>
          <Route path="/rider/login" element={<h1>Rider Login Page</h1>} />
          <Route
            path="/rider/dashboard"
            element={
              <RiderRoute>
                <SecretPage />
              </RiderRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Rider Login Page" })).toBeInTheDocument();
  });

  it("renders children when RIDER role is present", () => {
    useAuthStore.setState({
      accessToken: "token",
      role: "RIDER",
      storeId: "test-store-id"
    });

    render(
      <MemoryRouter initialEntries={["/rider/dashboard"]}>
        <Routes>
          <Route
            path="/rider/dashboard"
            element={
              <RiderRoute>
                <SecretPage />
              </RiderRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Rider Secret Content" })).toBeInTheDocument();
  });
});
