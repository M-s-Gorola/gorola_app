import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

import { useRecordConsent } from "./useRecordConsent";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    delete: vi.fn()
  }
}));

describe("useRecordConsent (Phase 8.9.2)", () => {
  it("posts canonical notice text and version to /api/v1/consent and invalidates cache", async () => {
    const postMock = vi.mocked(api!.post).mockResolvedValueOnce({
      data: { success: true, data: { id: "consent-123" } }
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValueOnce();

    const { result } = renderHook(() => useRecordConsent());
    const res = await result.current.recordConsent("ORDER_PROCESSING");

    expect(res.success).toBe(true);
    expect(postMock).toHaveBeenCalledWith(
      "/api/v1/consent",
      expect.objectContaining({
        purpose: "ORDER_PROCESSING",
        consentVersion: "1.0",
        noticeText: expect.stringContaining("We collect your delivery address")
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["consents"]
      })
    );
  });

  it("handles background network failure gracefully without throwing unhandled exception", async () => {
    vi.mocked(api!.post).mockRejectedValueOnce(new Error("Network timeout"));

    const { result } = renderHook(() => useRecordConsent());
    const res = await result.current.recordConsent("MARKETING_COMMS");

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("calls DELETE /api/v1/consent/:purpose on withdrawConsent and invalidates cache", async () => {
    const deleteMock = vi.mocked(api!.delete).mockResolvedValueOnce({
      data: { success: true }
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValueOnce();

    const { result } = renderHook(() => useRecordConsent());
    const res = await result.current.withdrawConsent("MARKETING_COMMS");

    expect(res.success).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith("/api/v1/consent/MARKETING_COMMS");
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["consents"]
      })
    );
  });
});
