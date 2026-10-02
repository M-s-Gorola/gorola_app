import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { DangerZoneSection } from "./DangerZoneSection";

vi.mock("@/lib/api", () => ({
  api: {
    delete: vi.fn()
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe("DangerZoneSection", () => {
  it("renders Danger Zone card with DPDP Act Sec 12 badge and trigger button", () => {
    render(
      <MemoryRouter>
        <DangerZoneSection />
      </MemoryRouter>
    );

    expect(screen.getByTestId("danger-zone-card")).toBeInTheDocument();
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(screen.getByText("DPDP Act Sec 12")).toBeInTheDocument();
    expect(screen.getByTestId("open-delete-dialog-btn")).toBeInTheDocument();
  });

  it("opens confirmation dialog and dispatches DELETE /api/v1/user/account on confirm", async () => {
    vi.mocked(api!.delete).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          isPendingDeletion: true,
          deletionScheduledFor: new Date().toISOString(),
          message: "Scheduled"
        }
      }
    });

    render(
      <MemoryRouter>
        <DangerZoneSection />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("open-delete-dialog-btn"));

    expect(screen.getByTestId("delete-account-dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirm Account Deletion")).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-delete-account-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api!.delete).toHaveBeenCalledWith("/api/v1/user/account");
    });
  });
});
