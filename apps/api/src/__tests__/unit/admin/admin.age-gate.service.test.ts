import { describe, expect, it } from "vitest";

import {
  buildLookupAuditPayload,
  calculateDaysRemaining,
  deriveAccountStatus,
  maskPhoneNumber
} from "../../../modules/admin/admin-age-gate.util.js";

describe("Admin Age Gate Utility Functions (Unit)", () => {
  describe("deriveAccountStatus", () => {
    it("returns PENDING_DELETION when deletionScheduledFor is set, regardless of isActive", () => {
      const status1 = deriveAccountStatus({
        isActive: true,
        isDeleted: false,
        deletionScheduledFor: new Date(Date.now() + 100000)
      });
      expect(status1).toBe("PENDING_DELETION");

      const status2 = deriveAccountStatus({
        isActive: false,
        isDeleted: false,
        deletionScheduledFor: new Date(Date.now() + 100000)
      });
      expect(status2).toBe("PENDING_DELETION");
    });

    it("returns SUSPENDED when isActive is false and not pending deletion", () => {
      const status = deriveAccountStatus({
        isActive: false,
        isDeleted: false,
        deletionScheduledFor: null
      });
      expect(status).toBe("SUSPENDED");
    });

    it("returns ACTIVE when isActive is true, not deleted, and not pending deletion", () => {
      const status = deriveAccountStatus({
        isActive: true,
        isDeleted: false,
        deletionScheduledFor: null
      });
      expect(status).toBe("ACTIVE");
    });
  });

  describe("calculateDaysRemaining", () => {
    it("calculates ceiling days remaining for future dates", () => {
      const now = new Date("2026-10-07T00:00:00Z");
      const lockedUntil = new Date("2026-10-10T12:00:00Z"); // 3.5 days in future -> 4 days
      expect(calculateDaysRemaining(lockedUntil, now)).toBe(4);
    });

    it("returns 0 for expired dates or exact current timestamp", () => {
      const now = new Date("2026-10-07T00:00:00Z");
      const past = new Date("2026-10-06T00:00:00Z");
      expect(calculateDaysRemaining(past, now)).toBe(0);
      expect(calculateDaysRemaining(now, now)).toBe(0);
    });
  });

  describe("maskPhoneNumber", () => {
    it("masks Indian mobile numbers revealing only the last 4 digits", () => {
      expect(maskPhoneNumber("+919876543210")).toBe("+91 ******3210");
      expect(maskPhoneNumber("9876543210")).toBe("+91 ******3210");
    });

    it("handles short or empty numbers gracefully", () => {
      expect(maskPhoneNumber("")).toBe("");
      expect(maskPhoneNumber("123")).toBe("123");
    });
  });

  describe("buildLookupAuditPayload", () => {
    it("returns clean boolean metadata with zero PII (no phone, phoneHash, or names)", () => {
      const payload = buildLookupAuditPayload(true, false);
      expect(payload).toEqual({
        foundLockout: true,
        foundAccount: false
      });
      expect(Object.keys(payload)).toEqual(["foundLockout", "foundAccount"]);
    });
  });
});
