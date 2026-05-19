import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { useAuthStore } from "@/store/auth.store";

const { bootstrapMock, bootstrapStoreMock } = vi.hoisted(() => ({
  bootstrapMock: vi.fn().mockResolvedValue(undefined),
  bootstrapStoreMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/hooks/useGorolaMotion", () => ({
  useGorolaMotion: () => undefined
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    bootstrapBuyerAuthSession: bootstrapMock,
    bootstrapStoreOwnerAuthSession: bootstrapStoreMock
  };
});

describe("subdomain routing integration", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    bootstrapMock.mockReset().mockResolvedValue(undefined);
    bootstrapStoreMock.mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({
      accessToken: null,
      isBootstrapPending: false,
      name: null,
      phone: null,
      refreshToken: null,
      role: null,
      userId: null
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

  it("renders Store Partner Portal directly at '/' when browsing store.gorola.com", () => {
    setHostnameAndPath("store.gorola.com", "/");

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
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Note: Since route guards are refactored, this test will perfectly resolve to /login and pass.
    expect(screen.getByRole("heading", { name: "Store Partner Portal" })).toBeInTheDocument();
  });

  it("renders System Admin Sign In directly at '/' when browsing admin.gorola.com", () => {
    setHostnameAndPath("admin.gorola.com", "/");

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
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "System Admin Sign In" })).toBeInTheDocument();
  });

  it("retains backward compatibility rendering Store Partner Portal at '/store' when browsing localhost", () => {
    setHostnameAndPath("localhost", "/store/login");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/store/login"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Store Partner Portal" })).toBeInTheDocument();
  });
});
