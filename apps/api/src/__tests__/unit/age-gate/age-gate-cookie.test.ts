import { describe, expect, it } from "vitest";

import {
  signDeviceCookie,
  verifyDeviceCookie
} from "../../../modules/age-gate/age-gate-cookie.js";

describe("Age Gate Device Cookie (8.8.3)", () => {
  it("signs and verifies valid device cooldown cookie within 24 hours", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const cookieValue = signDeviceCookie(now, 24);

    expect(cookieValue).toMatch(/^\d+\.[a-f0-9]{64}$/);

    // Immediately valid
    expect(verifyDeviceCookie(cookieValue, now)).toBe(true);

    // Valid 23 hours later
    const later23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    expect(verifyDeviceCookie(cookieValue, later23h)).toBe(true);

    // Invalid after 24 hours + 1 second
    const expired = new Date(now.getTime() + (24 * 60 * 60 + 1) * 1000);
    expect(verifyDeviceCookie(cookieValue, expired)).toBe(false);
  });

  it("rejects tampered signatures, garbage, empty, and malformed strings", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const cookieValue = signDeviceCookie(now, 24);

    // Tamper signature by changing last character
    const tampered = cookieValue.slice(0, -1) + (cookieValue.endsWith("a") ? "b" : "a");
    expect(verifyDeviceCookie(tampered, now)).toBe(false);

    expect(verifyDeviceCookie("", now)).toBe(false);
    expect(verifyDeviceCookie("garbage_value", now)).toBe(false);
    expect(verifyDeviceCookie("123.abc", now)).toBe(false);
    expect(verifyDeviceCookie(null, now)).toBe(false);
    expect(verifyDeviceCookie(undefined, now)).toBe(false);
  });
});
