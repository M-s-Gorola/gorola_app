/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InitialEntry } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreSetup2FAPage } from "./StoreSetup2FAPage";
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

function renderStoreSetup2FA(initialEntries: InitialEntry[]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/store/setup-2fa" element={<StoreSetup2FAPage />} />
          <Route path="/store/dashboard" element={<div data-testid="store-dashboard">Store Dashboard</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StoreSetup2FAPage", () => {
  beforeEach(() => {
    postMock.mockReset();
    useAuthStore.getState().clearSession();
  });

  it("calls setup-2fa on mount and renders TOTP secret, QR code and 6-digit confirmation code input", async () => {
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          secret: "JBSWY3DPEHPK3PXP",
          qrCodeUri: "otpauth://totp/GoRola:owner@store.com?secret=JBSWY3DPEHPK3PXP&issuer=GoRola"
        }
      }
    });

    renderStoreSetup2FA([
      { pathname: "/store/setup-2fa", state: { email: "owner@store.com" } }
    ]);

    expect(postMock).toHaveBeenCalledWith("/api/v1/auth/store-owner/setup-2fa", {
      email: "owner@store.com"
    });

    expect(await screen.findByText(/JBSWY3DPEHPK3PXP/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /qr code/i })).toHaveAttribute(
      "src",
      "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth%3A%2F%2Ftotp%2FGoRola%3Aowner%40store.com%3Fsecret%3DJBSWY3DPEHPK3PXP%26issuer%3DGoRola"
    );
    expect(screen.getByLabelText(/confirmation code/i)).toHaveAttribute("id", "setup-totp-code");
    expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
  });

  it("submitting with less than 6 digits shows validation error 'Code must be 6 digits'", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          secret: "JBSWY3DPEHPK3PXP",
          qrCodeUri: "otpauth://totp/GoRola:owner@store.com?secret=JBSWY3DPEHPK3PXP"
        }
      }
    });

    renderStoreSetup2FA([
      { pathname: "/store/setup-2fa", state: { email: "owner@store.com" } }
    ]);

    expect(await screen.findByLabelText(/confirmation code/i)).toBeInTheDocument();
    
    await user.type(screen.getByLabelText(/confirmation code/i), "12345");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/code must be 6 digits/i)).toBeInTheDocument();
  });

  it("on successful verification, calls verify-2fa and redirects to /store/dashboard", async () => {
    const user = userEvent.setup();
    // 1. mount setup request
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          secret: "JBSWY3DPEHPK3PXP",
          qrCodeUri: "otpauth://totp/GoRola:owner@store.com?secret=JBSWY3DPEHPK3PXP"
        }
      }
    });
    // 2. submit verification request
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: { verified: true }
      }
    });

    renderStoreSetup2FA([
      { pathname: "/store/setup-2fa", state: { email: "owner@store.com" } }
    ]);

    expect(await screen.findByLabelText(/confirmation code/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/confirmation code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenLastCalledWith("/api/v1/auth/store-owner/verify-2fa", {
        email: "owner@store.com",
        code: "123456"
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("store-dashboard")).toBeInTheDocument();
    });
  });
});
