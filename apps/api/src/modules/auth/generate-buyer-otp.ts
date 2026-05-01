import { randomInt } from "node:crypto";

/**
 * Cryptographically random 6-digit OTP.
 * Temporary emergency override: if `GOROLA_DUMMY_OTP` is set to six digits,
 * always returns it (including production). Remove once real SMS provider is live.
 * In `NODE_ENV=test`, `GOROLA_TEST_OTP` can still be used for deterministic tests.
 */
export function generateBuyerOtp(): string {
  const fixed = process.env.GOROLA_TEST_OTP?.trim();
  if (process.env.NODE_ENV === "test" && fixed !== undefined && fixed.length > 0) {
    if (!/^\d{6}$/.test(fixed)) {
      throw new Error("GOROLA_TEST_OTP must be exactly 6 digits when set");
    }
    return fixed;
  }

  const dummy = process.env.GOROLA_DUMMY_OTP?.trim();
  if (dummy !== undefined && dummy.length > 0) {
    if (!/^\d{6}$/.test(dummy)) {
      throw new Error("GOROLA_DUMMY_OTP must be exactly 6 digits when set");
    }
    return dummy;
  }
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
