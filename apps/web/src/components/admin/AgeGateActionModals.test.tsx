 
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DeclineModal,
  EraseUnderageModal,
  SuspendModal,
  UnlockModal
} from "./AgeGateActionModals";

const { postMock, putMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  putMock: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn((url: string, body: unknown) => postMock(url, body)),
    put: vi.fn((url: string, body: unknown) => putMock(url, body))
  }
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe("AgeGateActionModals Component Tests", () => {
  const onActionComplete = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    postMock.mockReset();
    putMock.mockReset();
    onActionComplete.mockReset();
    onClose.mockReset();
  });

  describe("UnlockModal", () => {
    it("renders unlock modal and submits valid reason >= 10 chars", async () => {
      postMock.mockResolvedValueOnce({ data: { success: true, data: { cleared: true } } });

      render(
        <UnlockModal
          isOpen={true}
          phone="+919876543210"
          onClose={onClose}
          onSuccess={onActionComplete}
        />
      );

      expect(screen.getByText(/Unlock Age-Gate Lockout/i)).toBeInTheDocument();
      const submitBtn = screen.getByRole("button", { name: /Confirm Unlock/i });
      expect(submitBtn).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/Enter reason for unlocking/i);
      fireEvent.change(textarea, { target: { value: "Short" } });
      expect(submitBtn).toBeDisabled();

      fireEvent.change(textarea, {
        target: { value: "Verified government ID showing user is 18+" }
      });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith("/api/v1/admin/age-gate/unlock", {
          phone: "+919876543210",
          reason: "Verified government ID showing user is 18+"
        });
        expect(onActionComplete).toHaveBeenCalled();
      });
    });
  });

  describe("DeclineModal", () => {
    it("renders decline modal and submits reason", async () => {
      postMock.mockResolvedValueOnce({
        data: { success: true, data: { recorded: true, declined: true } }
      });

      render(
        <DeclineModal
          isOpen={true}
          phone="+919876543210"
          onClose={onClose}
          onSuccess={onActionComplete}
        />
      );

      expect(screen.getByText(/Decline Age-Gate Appeal/i)).toBeInTheDocument();
      const submitBtn = screen.getByRole("button", { name: /Confirm Decline/i });
      expect(submitBtn).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/Enter reason for declining/i);
      fireEvent.change(textarea, {
        target: { value: "Documentation provided does not establish 18+ eligibility" }
      });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith("/api/v1/admin/age-gate/decline", {
          phone: "+919876543210",
          reason: "Documentation provided does not establish 18+ eligibility"
        });
        expect(onActionComplete).toHaveBeenCalled();
      });
    });
  });

  describe("SuspendModal", () => {
    it("renders suspend modal and submits user suspension", async () => {
      putMock.mockResolvedValueOnce({ data: { success: true, data: { isActive: false } } });

      render(
        <SuspendModal
          isOpen={true}
          userId="user-123"
          userName="Jane Doe"
          onClose={onClose}
          onSuccess={onActionComplete}
        />
      );

      expect(screen.getByText(/Suspend User Account/i)).toBeInTheDocument();
      const textarea = screen.getByPlaceholderText(/Optional suspension reason/i);
      fireEvent.change(textarea, {
        target: { value: "Account under investigation for age misrepresentation" }
      });

      const submitBtn = screen.getByRole("button", { name: /Suspend Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(putMock).toHaveBeenCalledWith("/api/v1/admin/users/user-123/suspend", {
          reason: "Account under investigation for age misrepresentation"
        });
        expect(onActionComplete).toHaveBeenCalled();
      });
    });
  });

  describe("EraseUnderageModal", () => {
    it("renders erase modal, requires 10+ char reason, and submits erase-underage", async () => {
      postMock.mockResolvedValueOnce({ data: { success: true, data: { erased: true } } });

      render(
        <EraseUnderageModal
          isOpen={true}
          userId="user-123"
          userName="Minor User"
          onClose={onClose}
          onSuccess={onActionComplete}
        />
      );

      expect(screen.getByText(/Erase Underage Account/i)).toBeInTheDocument();
      expect(screen.getByText(/Minor Data Purge \+ 90-Day Block/i)).toBeInTheDocument();
      expect(screen.getByText(/brand-new account/i)).toBeInTheDocument();

      const submitBtn = screen.getByRole("button", { name: /Erase & Block 90 Days/i });
      expect(submitBtn).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/Mandatory reason for underage erasure/i);
      fireEvent.change(textarea, {
        target: { value: "Confirmed minor user under DPDP Act 2023 compliance" }
      });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith("/api/v1/admin/users/user-123/erase-underage", {
          reason: "Confirmed minor user under DPDP Act 2023 compliance"
        });
        expect(onActionComplete).toHaveBeenCalled();
      });
    });
  });
});
