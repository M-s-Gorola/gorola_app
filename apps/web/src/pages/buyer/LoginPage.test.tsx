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

async function advanceToPhoneStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const continueBtn = screen.queryByTestId("consent-continue-btn");
  if (continueBtn) {
    await user.click(continueBtn);
  }
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    postMock.mockReset();
    postMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/consent") {
        return { data: { success: true } };
      }
      return undefined;
    });
    act(() => {
      useAuthStore.getState().clearSession();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial render displays consent notice step and link to /privacy", async () => {
    renderLogin(["/login"]);
    expect(screen.getByTestId("consent-notice-step")).toBeInTheDocument();
    expect(
      screen.getByText(/We collect your phone number to send a one-time password \(OTP\)/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute("href", "/privacy");
    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
  });

  it("clicking 'Continue & Accept' displays phone input step", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogin(["/login"]);
    await advanceToPhoneStep(user);
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  it("shows Zod validation when phone has wrong digit count", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogin(["/login"]);
    await advanceToPhoneStep(user);
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
    await advanceToPhoneStep(user);
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
    await advanceToPhoneStep(user);
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
    await advanceToPhoneStep(user);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));

    expect(
      await screen.findByText(/Too many attempts — try in 15 minutes/)
    ).toBeInTheDocument();
  });

  it("OTP digits fill and verify submit calls verify-otp and records consent", async () => {
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
      })
      .mockResolvedValueOnce({
        data: { success: true }
      });

    renderLogin(["/login"]);
    await advanceToPhoneStep(user);
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
      expect(postMock).toHaveBeenCalledWith("/api/v1/consent", {
        consentVersion: "1.0",
        noticeText: expect.any(String),
        purpose: "OTP_AUTH"
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
    await advanceToPhoneStep(user);
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
    await advanceToPhoneStep(user);
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
              message: "Invalid OTP",
              details: { attemptsRemaining: 4 }
            }
          }
        }
      });

    renderLogin(["/login"]);
    await advanceToPhoneStep(user);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);

    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), "9");
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/4 attempts left/i)).toBeInTheDocument();
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
              message: "Verification locked for 15 minutes"
            }
          }
        }
      });

    renderLogin(["/login"]);
    await advanceToPhoneStep(user);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);

    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), "9");
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(
      await screen.findByText(/Verification locked for 15 minutes/i)
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

    await advanceToPhoneStep(user);
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

    await advanceToPhoneStep(user);
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
    await advanceToPhoneStep(user);
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

  it("shows reactivation prompt when account is pending deletion and restores account on confirm", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock
      .mockResolvedValueOnce({ data: { success: true, data: { sent: true } } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            accessToken: "access_pending",
            name: "Arjun",
            phone: "+919876543210",
            refreshToken: "refresh_pending",
            userId: "buyer-del-1",
            isPendingDeletion: true,
            deletionScheduledFor: "2026-10-24T12:00:00.000Z"
          }
        }
      })
      .mockResolvedValueOnce({ data: { success: true } }) // reactivate-account
      .mockResolvedValueOnce({ data: { success: true } }); // consent

    renderLogin(["/login"]);
    await advanceToPhoneStep(user);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);

    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), String(i + 1));
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByTestId("reactivate-account-step")).toBeInTheDocument();
    expect(screen.getByText(/Account Scheduled for Deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/24 Oct 2026/i)).toBeInTheDocument();

    const reactivateBtn = screen.getByTestId("reactivate-account-btn");
    await user.click(reactivateBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/api/v1/user/reactivate-account",
        {},
        { headers: { Authorization: "Bearer access_pending" } }
      );
      expect(useAuthStore.getState().userId).toBe("buyer-del-1");
      expect(screen.getByTestId("probe-path")).toHaveTextContent("/");
    });
  });

  it("resets login flow when user chooses to keep deletion scheduled and sign out", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    postMock
      .mockResolvedValueOnce({ data: { success: true, data: { sent: true } } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            accessToken: "access_pending",
            name: "Arjun",
            phone: "+919876543210",
            refreshToken: "refresh_pending",
            userId: "buyer-del-1",
            isPendingDeletion: true,
            deletionScheduledFor: "2026-10-24T12:00:00.000Z"
          }
        }
      });

    renderLogin(["/login"]);
    await advanceToPhoneStep(user);
    await user.type(screen.getByLabelText(/phone number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByText(/Enter OTP/i);

    for (let i = 0; i < 6; i++) {
      const label = String(i + 1);
      await user.type(screen.getByRole("spinbutton", { name: new RegExp(`^Digit ${label}$`, "i") }), String(i + 1));
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByTestId("reactivate-account-step")).toBeInTheDocument();

    const signoutBtn = screen.getByTestId("keep-deletion-logout-btn");
    await user.click(signoutBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });
});
