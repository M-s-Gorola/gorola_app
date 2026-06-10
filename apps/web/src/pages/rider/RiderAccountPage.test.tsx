/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RiderAccountPage } from "./RiderAccountPage";
import { useAuthStore } from "@/store/auth.store";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    post: postMock
  }
}));

function renderRiderAccount(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  render(
    <MemoryRouter initialEntries={["/rider/account"]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/rider/account" element={<RiderAccountPage />} />
          <Route path="/rider/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("RiderAccountPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    useAuthStore.getState().setRiderSession({
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
      userId: "rider-123",
      storeId: "store-456"
    });
  });

  it("renders loading state initially", () => {
    // Return a pending promise so it stays in loading state
    getMock.mockReturnValue(new Promise(() => {}));

    renderRiderAccount();

    expect(screen.getByTestId("profile-loading")).toBeInTheDocument();
  });

  it("displays rider name, email, and store name on success", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "rider-123",
          name: "Ravi Dev",
          email: "ravi@gorola.in",
          phone: "+919000000003",
          riderType: "DELIVERY",
          store: {
            id: "store-456",
            name: "Mussoorie Quick Mart"
          }
        }
      }
    });

    renderRiderAccount();

    // Verify information is displayed
    expect(await screen.findByText("Ravi Dev")).toBeInTheDocument();
    expect(screen.getByText("ravi@gorola.in")).toBeInTheDocument();
    expect(screen.getByText("+919000000003")).toBeInTheDocument();
    expect(screen.getByText("Mussoorie Quick Mart")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("handles logout successfully", async () => {
    const user = userEvent.setup();
    const clearSessionSpy = vi.spyOn(useAuthStore.getState(), "clearSession");

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "rider-123",
          name: "Ravi Dev",
          email: "ravi@gorola.in",
          phone: "+919000000003",
          riderType: "DELIVERY",
          store: {
            id: "store-456",
            name: "Mussoorie Quick Mart"
          }
        }
      }
    });

    postMock.mockResolvedValueOnce({
      data: {
        success: true
      }
    });

    renderRiderAccount();

    const logoutButton = await screen.findByRole("button", { name: /logout/i });
    await user.click(logoutButton);

    await waitFor(() => {
      // Assert that API logout was called
      expect(postMock).toHaveBeenCalledWith("/api/v1/rider/auth/logout", {
        refreshToken: "fake-refresh"
      });
      // Assert that auth store session was cleared
      expect(clearSessionSpy).toHaveBeenCalled();
    });

    // Assert redirection to login page
    expect(await screen.findByTestId("login-page")).toBeInTheDocument();
  });
});
