import { describe, expect, it } from "vitest";

import {
  CANONICAL_CONSENT_NOTICES,
  CONSENT_NOTICES,
  ConsentPurpose,
  getCanonicalNoticeText,
  isPurposeEssential
} from "../consent-notices.js";

describe("Canonical Consent Notices Registry (Phase 8.9.1)", () => {
  it("preserves backward compatibility with legacy CONSENT_NOTICES dictionary", () => {
    expect(CONSENT_NOTICES).toBeDefined();
    expect(CONSENT_NOTICES.OTP_AUTH["1.0"]).toContain("One-Time Password");
    expect(CONSENT_NOTICES.OTP_AUTH["1.1"]).toContain("GoRola is for people aged 18 and over");
    expect(CONSENT_NOTICES.AGE_DECLARATION["1.1"]).toContain("18 and over");
  });

  it("exports all 5 statutory DPDP consent purposes in CANONICAL_CONSENT_NOTICES", () => {
    const purposes = Object.keys(CANONICAL_CONSENT_NOTICES) as ConsentPurpose[];
    expect(purposes).toHaveLength(5);
    expect(purposes).toContain("OTP_AUTH");
    expect(purposes).toContain("AGE_DECLARATION");
    expect(purposes).toContain("ORDER_PROCESSING");
    expect(purposes).toContain("MARKETING_COMMS");
    expect(purposes).toContain("ANALYTICS");
  });

  it("defines complete statutory metadata for each purpose", () => {
    const canonicalPurposes: ConsentPurpose[] = [
      "OTP_AUTH",
      "AGE_DECLARATION",
      "ORDER_PROCESSING",
      "MARKETING_COMMS",
      "ANALYTICS"
    ];

    for (const p of canonicalPurposes) {
      const entry = CANONICAL_CONSENT_NOTICES[p];
      expect(entry).toBeDefined();
      expect(entry.purpose).toBe(p);
      expect(typeof entry.title).toBe("string");
      expect(entry.title.length).toBeGreaterThan(0);
      expect(typeof entry.version).toBe("string");
      expect(entry.version.length).toBeGreaterThan(0);
      expect(typeof entry.effectiveDate).toBe("string");
      expect(entry.effectiveDate.length).toBeGreaterThan(0);
      expect(typeof entry.summaryText).toBe("string");
      expect(entry.summaryText.length).toBeGreaterThan(20);
      expect(typeof entry.plainText).toBe("string");
      expect(entry.plainText.length).toBeGreaterThan(20);
      expect(typeof entry.noticeTriggerLabel).toBe("string");
      expect(entry.noticeTriggerLabel.length).toBeGreaterThan(0);
      expect(typeof entry.checkboxLabel).toBe("string");
      expect(entry.checkboxLabel.length).toBeGreaterThan(0);

      // Section 5 statutory disclosures
      expect(Array.isArray(entry.disclosures.dataCollected)).toBe(true);
      expect(entry.disclosures.dataCollected.length).toBeGreaterThan(0);
      expect(typeof entry.disclosures.thirdParties).toBe("string");
      expect(typeof entry.disclosures.retention).toBe("string");
      expect(typeof entry.disclosures.rights).toBe("string");
    }
  });

  it("correctly identifies essential vs optional purposes via isEssential and isPurposeEssential()", () => {
    expect(CANONICAL_CONSENT_NOTICES.OTP_AUTH.isEssential).toBe(true);
    expect(CANONICAL_CONSENT_NOTICES.AGE_DECLARATION.isEssential).toBe(true);
    expect(CANONICAL_CONSENT_NOTICES.ORDER_PROCESSING.isEssential).toBe(true);
    expect(CANONICAL_CONSENT_NOTICES.MARKETING_COMMS.isEssential).toBe(false);
    expect(CANONICAL_CONSENT_NOTICES.ANALYTICS.isEssential).toBe(false);

    expect(isPurposeEssential("OTP_AUTH")).toBe(true);
    expect(isPurposeEssential("AGE_DECLARATION")).toBe(true);
    expect(isPurposeEssential("ORDER_PROCESSING")).toBe(true);
    expect(isPurposeEssential("MARKETING_COMMS")).toBe(false);
    expect(isPurposeEssential("ANALYTICS")).toBe(false);
  });

  it("returns canonical plain text for logging through getCanonicalNoticeText()", () => {
    const otpText = getCanonicalNoticeText("OTP_AUTH");
    expect(otpText).toBe(CANONICAL_CONSENT_NOTICES.OTP_AUTH.plainText);
    expect(otpText).toContain("Exotel");

    const orderText = getCanonicalNoticeText("ORDER_PROCESSING");
    expect(orderText).toBe(CANONICAL_CONSENT_NOTICES.ORDER_PROCESSING.plainText);
    expect(orderText).toContain("Ola Maps");
    expect(orderText).toContain("Razorpay");

    const marketingText = getCanonicalNoticeText("MARKETING_COMMS");
    expect(marketingText).toBe(CANONICAL_CONSENT_NOTICES.MARKETING_COMMS.plainText);
    expect(marketingText).toContain("voluntary");

    const analyticsText = getCanonicalNoticeText("ANALYTICS");
    expect(analyticsText).toBe(CANONICAL_CONSENT_NOTICES.ANALYTICS.plainText);
    expect(analyticsText).toContain("telemetry");
  });
});
