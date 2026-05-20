import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { CategoryPage } from "@/pages/buyer/CategoryPage";
import { HomePage } from "@/pages/HomePage";
import { useAuthStore } from "@/store/auth.store";

const { bootstrapMock } = vi.hoisted(() => ({
  bootstrapMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/hooks/useGorolaMotion", () => ({
  useGorolaMotion: () => undefined
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    bootstrapBuyerAuthSession: bootstrapMock
  };
});

describe("buyer routes", () => {
  beforeEach(() => {
    bootstrapMock.mockReset();
    bootstrapMock.mockResolvedValue(undefined);
    useAuthStore.setState({
      accessToken: null,
      isBootstrapPending: true,
      name: null,
      phone: null,
      refreshToken: null,
      role: null,
      userId: null
    });
  });

  it("renders home for /", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<HomePage apiBaseForDisplay="https://t" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText("Categories")).toBeInTheDocument();
  });

  it("renders category page for /categories/:slug", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/categories/groceries"]}>
          <Routes>
            <Route path="/categories/:slug" element={<CategoryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole("heading", { name: "Groceries" })).toBeInTheDocument();
  });

  it("renders order confirmation route for /orders/:id in runtime app router", () => {
    useAuthStore.getState().setBuyerSession({
      accessToken: "at",
      name: null,
      phone: "+910000000000",
      refreshToken: "rt",
      userId: "buyer-1"
    });
    useAuthStore.getState().setBootstrapPending(false);

    render(
      <MemoryRouter initialEntries={["/orders/order-123"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /order confirmation/i })).toBeInTheDocument();
  });

  it("does not bounce to login when auth bootstrap resolves a protected deep link", async () => {
    bootstrapMock.mockImplementation(async () => {
      useAuthStore.getState().setBootstrapPending(true);
      await Promise.resolve();
      useAuthStore.getState().setBuyerSession({
        accessToken: "at",
        name: null,
        phone: "+910000000000",
        refreshToken: "rt",
        userId: "buyer-1"
      });
      useAuthStore.getState().setBootstrapPending(false);
    });

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Restoring your session...")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Your Profile" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Verify OTP" })).not.toBeInTheDocument();
  });

  it("resolves footer discoverability links without dead-end navigation", async () => {
    useAuthStore.getState().setBootstrapPending(false);
    const user = userEvent.setup();

    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("link", { name: "About" }));
    rerender(
      <MemoryRouter initialEntries={["/about"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    await user.click(screen.getByRole("link", { name: "Support" }));
    rerender(
      <MemoryRouter initialEntries={["/support"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Support" })).toBeInTheDocument();
  });

  it("shows placeholder route guardrails for in-progress pages", () => {
    useAuthStore.getState().setBuyerSession({
      accessToken: "at",
      name: null,
      phone: "+910000000000",
      refreshToken: "rt",
      userId: "buyer-1"
    });
    useAuthStore.getState().setBootstrapPending(false);

    const searchRender = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/search"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole("heading", { name: "Search" })).toBeInTheDocument();
    searchRender.unmount();

    const profileRender = render(
      <MemoryRouter initialEntries={["/profile"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Your Profile" })).toBeInTheDocument();
    profileRender.unmount();

    const noRoleStoreRender = render(
      <MemoryRouter initialEntries={["/store"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.queryByRole("heading", { name: "Store Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("This page is not ready yet.")).not.toBeInTheDocument();
    noRoleStoreRender.unmount();

    useAuthStore.setState({
      accessToken: "at",
      role: "STORE_OWNER",
      twoFactorVerified: true
    });
    render(
      <MemoryRouter initialEntries={["/store"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId("kpi-skeleton-orders")).toBeInTheDocument();
  });

  it("renders query-aware search page for /search?q=", () => {
    useAuthStore.getState().setBootstrapPending(false);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/search?q=bread"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Search" })).toBeInTheDocument();
  });
});
