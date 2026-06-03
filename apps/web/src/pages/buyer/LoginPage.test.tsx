/* eslint-disable simple-import-sort/imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import type { InitialEntry } from "react-router-dom";
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage";

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

function LocationProbe(): ReactElement {
  const loc = useLocation();
  return <div data-testid="probe-path">{loc.pathname}{loc.search}</div>;
}

function renderLogin(initialEntries: InitialEntry[]): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div data-testid="home">Home</div>} />
            <Route path="/profile" element={<div data-testid="profile">Profile</div>} />
            <Route
              path="/require-auth"
              element={
                <Navigate
                  replace
                  state={{ from: { pathname: "/profile" } }}
                  to="/login"
                />
              }
            />
          </Routes>
          <LocationProbe />
        </>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    postMock.mockReset();
    act(() => {
      useAuthStore.getState().clearSession();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Zod validation when phone has wrong digit count", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "98765");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByText(/10 digits/i)).toBeInTheDocument();
  });

  it("submits normalized E.164 phone to send-otp and advances to OTP step", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock.mockResolvedValueOnce({
      data: { success: true, data: { sent: true } }
    });

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/buyer/send-otp", {
        phone: "+919876543210"
      });
    });
    expect(await screen.findByText(/enter otp/i)).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton", { name: /^Digit \d$/i })).toHaveLength(6);
  });

  it("shows loading state on send OTP button while request pending", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock.mockReturnValueOnce(new Promise(() => undefined));

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));

    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
  });

  it("shows rate limit message when send-otp returns 429", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock.mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many attempts — try in 15 minutes"
          }
        }
      }
    });

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));

    expect(
      await screen.findByText(/Too many attempts — try in 15 minutes/)
    ).toBeInTheDocument();
  });

  it("OTP digits fill and verify submit calls verify-otp with full code", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock
      .mockResolvedValueOnce({ data: { success: true, data: { sent: true } } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            accessToken: "access",
            name: null,
            phone: "+919876543210",
            refreshToken: "refresh",
            userId: "buyer-u1"
          }
        }
      });

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);

    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), String(i + 1));
    }

    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/auth/buyer/verify-otp", {
        otp: "123456",
        phone: "+919876543210"
      });
    });

    expect(useAuthStore.getState().accessToken).toBe("access");
    expect(useAuthStore.getState().refreshToken).toBe("refresh");
    expect(useAuthStore.getState().userId).toBe("buyer-u1");
    expect(useAuthStore.getState().phone).toBe("+919876543210");
    expect(useAuthStore.getState().name).toBeNull();
    expect(useAuthStore.getState().role).toBe("BUYER");
  });

  it("shows countdown timer from 5:00 and enables resend when timer reaches zero", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock.mockResolvedValueOnce({ data: { success: true, data: { sent: true } } });

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);

    expect(screen.getByText(/^Expires in 5:00$/)).toBeInTheDocument();

    const resend = screen.getByRole("button", { name: /resend otp/i });
    expect(resend).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/^Expires in 0:00$/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /resend otp/i })).toBeEnabled();
    });
  });

  it("resend calls send-otp again", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock.mockResolvedValue({ data: { success: true, data: { sent: true } } });

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    await user.click(screen.getByRole("button", { name: /resend otp/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(2);
      expect(postMock).toHaveBeenLastCalledWith("/api/v1/auth/buyer/send-otp", {
        phone: "+919876543210"
      });
    });
  });

  it("shows wrong OTP with attempts remaining from API envelope", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock
      .mockResolvedValueOnce({ data: { success: true, data: { sent: true } } })
      .mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              details: { attemptsRemaining: 2 },
              message: "Invalid OTP"
            }
          }
        }
      });

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);

    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), "9");
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/2 attempts left/i)).toBeInTheDocument();
  });

  it("shows lockout message when OTP verification locked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock
      .mockResolvedValueOnce({ data: { success: true, data: { sent: true } } })
      .mockRejectedValueOnce({
        response: {
          status: 429,
          data: {
            success: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many incorrect OTP attempts. Try requesting a new code."
            }
          }
        }
      });

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);
    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), "8");
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(
      await screen.findByText(/Too many incorrect OTP attempts/i)
    ).toBeInTheDocument();
  });

  it("redirects to state.from.pathname after successful verify when present", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock
      .mockResolvedValueOnce({ data: { success: true, data: { sent: true } } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            accessToken: "access",
            name: null,
            phone: "+919876543210",
            refreshToken: "refresh",
            userId: "buyer-u1"
          }
        }
      });

    renderLogin([
      {
        pathname: "/login",
        state: { from: { pathname: "/profile" } }
      }
    ]);

    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);
    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), String(i + 1));
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByTestId("probe-path")).toHaveTextContent("/profile");
    });
  });

  it("redirects to state.from.pathname and preserves query search parameters after successful verify", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock
      .mockResolvedValueOnce({ data: { success: true, data: { sent: true } } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            accessToken: "access",
            name: null,
            phone: "+919876543210",
            refreshToken: "refresh",
            userId: "buyer-u1"
          }
        }
      });

    renderLogin([
      {
        pathname: "/login",
        state: { from: { pathname: "/profile", search: "?productId=p2&variantId=v3" } }
      }
    ]);

    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);
    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), String(i + 1));
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByTestId("probe-path")).toHaveTextContent("/profile?productId=p2&variantId=v3");
    });
  });

  it("redirects to home after successful verify when no return path", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock
      .mockResolvedValueOnce({ data: { success: true, data: { sent: true } } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            accessToken: "access",
            name: null,
            phone: "+919876543210",
            refreshToken: "refresh",
            userId: "buyer-u1"
          }
        }
      });

    renderLogin(["/login"]);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);
    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), String(i + 1));
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByTestId("probe-path")).toHaveTextContent("/");
    });
  });
});
