import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { ActiveSessionsSection } from "./ActiveSessionsSection";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe("ActiveSessionsSection", () => {
  it("renders Active Sessions section with session cards and current session badge", async () => {
    vi.mocked(api!.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          sessions: [
            {
              sessionId: "sess-1",
              ipAddress: "14.139.240.10",
              userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
              createdAt: "2026-10-02T10:00:00.000Z",
              lastActiveAt: "2026-10-02T10:30:00.000Z",
              isCurrent: true
            },
            {
              sessionId: "sess-2",
              ipAddress: "103.21.244.2",
              userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
              createdAt: "2026-10-01T08:00:00.000Z",
              lastActiveAt: "2026-10-01T08:00:00.000Z",
              isCurrent: false
            }
          ]
        }
      }
    });

    render(<ActiveSessionsSection />);

    expect(screen.getByTestId("active-sessions-card")).toBeInTheDocument();
    expect(screen.getByText("Active Login Sessions")).toBeInTheDocument();
    expect(screen.getByText("DPDP Act Sec 8(5)")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("session-row-sess-1")).toBeInTheDocument();
      expect(screen.getByTestId("current-session-badge")).toBeInTheDocument();
      expect(screen.getByText("14.139.240.10")).toBeInTheDocument();
      expect(screen.getByTestId("session-row-sess-2")).toBeInTheDocument();
      expect(screen.getByText("103.21.244.2")).toBeInTheDocument();
      expect(screen.getByTestId("sign-out-all-btn")).toBeInTheDocument();
    });
  });

  it("calls DELETE /api/v1/auth/sessions when Sign Out All Devices is confirmed", async () => {
    vi.mocked(api!.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          sessions: [
            {
              sessionId: "sess-1",
              ipAddress: "14.139.240.10",
              userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
              createdAt: "2026-10-02T10:00:00.000Z",
              lastActiveAt: "2026-10-02T10:30:00.000Z",
              isCurrent: true
            }
          ]
        }
      }
    });

    vi.mocked(api!.delete).mockResolvedValueOnce({
      data: {
        success: true,
        data: { terminatedCount: 1 }
      }
    });

    render(<ActiveSessionsSection />);

    await waitFor(() => {
      expect(screen.getByTestId("sign-out-all-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("sign-out-all-btn"));

    await waitFor(() => {
      expect(api!.delete).toHaveBeenCalledWith("/api/v1/auth/sessions");
    });
  });
});
