import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";

import { AnalyticsConsentBanner } from "./AnalyticsConsentBanner";

const postMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    post: (...args: unknown[]) => postMock(...args)
  }
}));

describe("AnalyticsConsentBanner (DPDP 8.2.7 - Option A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.getState().clearSession();
  });

  it("does not render when user is not authenticated (guest)", () => {
    render(<AnalyticsConsentBanner />);
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });

  it("does not render when user is authenticated with a non-buyer role (e.g. RIDER, STORE_OWNER)", () => {
    useAuthStore.setState({
      accessToken: "mock-rider-token",
      userId: "rider-123",
      role: "RIDER"
    });

    render(<AnalyticsConsentBanner />);
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });

  it("renders prominent banner for authenticated BUYER when no consent choice exists in localStorage", () => {
    useAuthStore.setState({
      accessToken: "mock-buyer-token",
      userId: "buyer-123",
      role: "BUYER"
    });

    render(<AnalyticsConsentBanner />);

    expect(screen.getByTestId("analytics-consent-banner")).toBeInTheDocument();
    expect(screen.getByText(/Help Us Improve Hill Deliveries/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept Analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Decline|Essential Only/i })).toBeInTheDocument();
  });

  it("does not render for authenticated buyer if they previously made a choice in localStorage", () => {
    useAuthStore.setState({
      accessToken: "mock-buyer-token",
      userId: "buyer-123",
      role: "BUYER"
    });
    localStorage.setItem("gorola_analytics_consent", "declined");

    render(<AnalyticsConsentBanner />);

    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });

  it("clicking 'Accept Analytics' records consent via API, saves to localStorage, and dismisses banner", async () => {
    useAuthStore.setState({
      accessToken: "mock-buyer-token",
      userId: "buyer-123",
      role: "BUYER"
    });
    postMock.mockResolvedValueOnce({ data: { success: true } });

    render(<AnalyticsConsentBanner />);

    const acceptBtn = screen.getByRole("button", { name: /Accept Analytics/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/consent", expect.objectContaining({
        purpose: "ANALYTICS",
        consentVersion: "1.0"
      }));
    });

    expect(localStorage.getItem("gorola_analytics_consent")).toBe("accepted");
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });

  it("clicking 'Decline' saves declined state in localStorage and dismisses without calling API", async () => {
    useAuthStore.setState({
      accessToken: "mock-buyer-token",
      userId: "buyer-123",
      role: "BUYER"
    });

    render(<AnalyticsConsentBanner />);

    const declineBtn = screen.getByRole("button", { name: /Decline|Essential Only/i });
    fireEvent.click(declineBtn);

    expect(postMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("gorola_analytics_consent")).toBe("declined");
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });
});


