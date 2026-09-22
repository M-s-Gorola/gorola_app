import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsConsentBanner } from "./AnalyticsConsentBanner";

const postMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    post: (...args: unknown[]) => postMock(...args)
  }
}));

describe("AnalyticsConsentBanner (DPDP 8.2.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders prominent banner on first load when no consent choice exists in localStorage", () => {
    render(<AnalyticsConsentBanner />);

    expect(screen.getByTestId("analytics-consent-banner")).toBeInTheDocument();
    expect(screen.getByText(/Help Us Improve Hill Deliveries/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept Analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Decline|Essential Only/i })).toBeInTheDocument();
  });

  it("does not render if user previously made a choice in localStorage", () => {
    localStorage.setItem("gorola_analytics_consent", "declined");
    render(<AnalyticsConsentBanner />);

    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });

  it("clicking 'Accept Analytics' records consent via API, saves to localStorage, and dismisses banner", async () => {
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
    render(<AnalyticsConsentBanner />);

    const declineBtn = screen.getByRole("button", { name: /Decline|Essential Only/i });
    fireEvent.click(declineBtn);

    expect(postMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("gorola_analytics_consent")).toBe("declined");
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });
});
