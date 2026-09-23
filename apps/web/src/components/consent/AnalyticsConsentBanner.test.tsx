import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/store/auth.store";

import { AnalyticsConsentBanner } from "./AnalyticsConsentBanner";

const getMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args)
  }
}));

describe("AnalyticsConsentBanner (DPDP 8.2.7 - Option A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.getState().clearSession();
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          consents: []
        }
      }
    });
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

  it("renders prominent banner for authenticated BUYER when no consent choice exists in localStorage and no server record", async () => {
    useAuthStore.setState({
      accessToken: "mock-buyer-token",
      userId: "buyer-123",
      role: "BUYER"
    });

    render(<AnalyticsConsentBanner />);

    expect(await screen.findByTestId("analytics-consent-banner")).toBeInTheDocument();
    expect(screen.getByText(/Usage & Performance Analytics/i)).toBeInTheDocument();
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
    expect(getMock).not.toHaveBeenCalled();
  });

  it("syncs from server and does not render on new device if user previously accepted on server", async () => {
    useAuthStore.setState({
      accessToken: "mock-buyer-token",
      userId: "buyer-123",
      role: "BUYER"
    });

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          consents: [
            {
              id: "c-analytics",
              purpose: "ANALYTICS",
              consentVersion: "1.0",
              noticeText: "Telemetry notice",
              isWithdrawn: false,
              withdrawnAt: null,
              createdAt: "2026-09-22T00:00:00Z"
            }
          ]
        }
      }
    });

    render(<AnalyticsConsentBanner />);

    await waitFor(() => {
      expect(localStorage.getItem("gorola_analytics_consent")).toBe("accepted");
    });
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });

  it("syncs from server and does not render on new device if user previously withdrew on server", async () => {
    useAuthStore.setState({
      accessToken: "mock-buyer-token",
      userId: "buyer-123",
      role: "BUYER"
    });

    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          consents: [
            {
              id: "c-analytics",
              purpose: "ANALYTICS",
              consentVersion: "1.0",
              noticeText: "Telemetry notice",
              isWithdrawn: true,
              withdrawnAt: "2026-09-22T01:00:00Z",
              createdAt: "2026-09-22T00:00:00Z"
            }
          ]
        }
      }
    });

    render(<AnalyticsConsentBanner />);

    await waitFor(() => {
      expect(localStorage.getItem("gorola_analytics_consent")).toBe("declined");
    });
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

    const acceptBtn = await screen.findByRole("button", { name: /Accept Analytics/i });
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

  it("clicking 'Decline' calls DELETE /api/v1/consent/ANALYTICS, saves declined in localStorage and dismisses banner", async () => {
    useAuthStore.setState({
      accessToken: "mock-buyer-token",
      userId: "buyer-123",
      role: "BUYER"
    });
    deleteMock.mockResolvedValueOnce({ data: { success: true } });

    render(<AnalyticsConsentBanner />);

    const declineBtn = await screen.findByRole("button", { name: /Decline|Essential Only/i });
    fireEvent.click(declineBtn);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("/api/v1/consent/ANALYTICS");
    });
    expect(localStorage.getItem("gorola_analytics_consent")).toBe("declined");
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });
});


