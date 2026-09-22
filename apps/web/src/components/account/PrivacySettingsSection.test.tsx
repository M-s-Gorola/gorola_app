import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacySettingsSection } from "./PrivacySettingsSection";

const { getMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  deleteMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    delete: deleteMock,
    post: vi.fn()
  }
}));

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PrivacySettingsSection />
    </QueryClientProvider>
  );
}

describe("PrivacySettingsSection (DPDP 8.2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders list of consents, showing Essential label for OTP_AUTH and Withdraw button for MARKETING_EMAIL", async () => {
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

    renderSection();

    expect(await screen.findByText(/Privacy & Consent Preferences/i)).toBeInTheDocument();
    expect(screen.getByText(/OTP_AUTH/i)).toBeInTheDocument();
    expect(screen.getByText(/MARKETING_EMAIL/i)).toBeInTheDocument();

    // Essential consent should have Essential badge, no Withdraw button
    expect(screen.getByText(/Essential/i)).toBeInTheDocument();
    expect(screen.queryByTestId("withdraw-btn-OTP_AUTH")).not.toBeInTheDocument();

    // Non-essential consent should have Withdraw button
    expect(screen.getByTestId("withdraw-btn-MARKETING_EMAIL")).toBeInTheDocument();
  });

  it("clicking Withdraw on MARKETING_EMAIL calls DELETE /api/v1/consent/MARKETING_EMAIL and updates status to Withdrawn", async () => {
    const user = userEvent.setup();
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          consents: [
            {
              id: "c2",
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

    deleteMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          consent: {
            id: "c2",
            purpose: "MARKETING_EMAIL",
            isWithdrawn: true,
            withdrawnAt: "2026-09-22T01:00:00Z"
          }
        }
      }
    });

    renderSection();

    const withdrawBtn = await screen.findByTestId("withdraw-btn-MARKETING_EMAIL");
    await user.click(withdrawBtn);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("/api/v1/consent/MARKETING_EMAIL");
    });

    const withdrawnElements = await screen.findAllByText(/Withdrawn/i);
    expect(withdrawnElements.length).toBeGreaterThan(0);
  });
});
