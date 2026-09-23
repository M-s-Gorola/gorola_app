import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacySettingsPage } from "./PrivacySettingsPage";

const getMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    post: (...args: unknown[]) => postMock(...args)
  }
}));

function renderPrivacyPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PrivacySettingsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PrivacySettingsPage (DPDP 8.2 & Account Settings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders page title, DPDP Act description, and all 4 canonical consent cards", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          consents: [
            {
              id: "c1",
              purpose: "OTP_AUTH",
              consentVersion: "1.0",
              noticeText: "OTP auth",
              isWithdrawn: false,
              withdrawnAt: null,
              createdAt: "2026-09-22T00:00:00Z"
            },
            {
              id: "c2",
              purpose: "ORDER_PROCESSING",
              consentVersion: "1.0",
              noticeText: "Order processing",
              isWithdrawn: false,
              withdrawnAt: null,
              createdAt: "2026-09-22T00:00:00Z"
            },
            {
              id: "c3",
              purpose: "MARKETING_EMAIL",
              consentVersion: "1.0",
              noticeText: "Marketing updates",
              isWithdrawn: false,
              withdrawnAt: null,
              createdAt: "2026-09-22T00:00:00Z"
            }
          ]
        }
      }
    });

    renderPrivacyPage();

    expect(
      screen.getByRole("heading", { name: /privacy & data rights/i, level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Manage your statutory consent preferences and data privacy controls/i)
    ).toBeInTheDocument();

    expect(await screen.findByTestId("consent-card-OTP_AUTH")).toBeInTheDocument();
    expect(screen.getByTestId("consent-card-ORDER_PROCESSING")).toBeInTheDocument();
    expect(screen.getByTestId("consent-card-MARKETING_EMAIL")).toBeInTheDocument();
    expect(screen.getByTestId("consent-card-ANALYTICS")).toBeInTheDocument();

    // Verify Essential badges on mandatory cards
    expect(screen.getAllByText(/Essential/i)).toHaveLength(2);
  });

  it("allows withdrawing MARKETING_EMAIL consent from the privacy page", async () => {
    const user = userEvent.setup();

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          consents: [
            {
              id: "c-mkt",
              purpose: "MARKETING_EMAIL",
              consentVersion: "1.0",
              noticeText: "Marketing",
              isWithdrawn: false,
              withdrawnAt: null,
              createdAt: "2026-09-22T00:00:00Z"
            }
          ]
        }
      }
    });

    deleteMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          consent: {
            id: "c-mkt",
            purpose: "MARKETING_EMAIL",
            isWithdrawn: true,
            withdrawnAt: "2026-09-22T01:00:00Z"
          }
        }
      }
    });

    renderPrivacyPage();

    const withdrawBtn = await screen.findByTestId("withdraw-btn-MARKETING_EMAIL");
    await user.click(withdrawBtn);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("/api/v1/consent/MARKETING_EMAIL");
    });
  });

  it("allows opting in to ANALYTICS consent and syncs with localStorage", async () => {
    const user = userEvent.setup();

    getMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          consents: []
        }
      }
    });

    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          consent: {
            id: "c-analytics",
            purpose: "ANALYTICS",
            consentVersion: "1.0",
            noticeText: "Telemetry notice",
            isWithdrawn: false,
            withdrawnAt: null,
            createdAt: "2026-09-24T00:00:00Z"
          }
        }
      }
    });

    renderPrivacyPage();

    const optInBtn = await screen.findByTestId("optin-btn-ANALYTICS");
    await user.click(optInBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/v1/consent", expect.objectContaining({
        purpose: "ANALYTICS"
      }));
      expect(localStorage.getItem("gorola_analytics_consent")).toBe("accepted");
    });
  });
});
