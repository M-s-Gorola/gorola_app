import { randomInt } from "node:crypto";

/**
 * Cryptographically random 6-digit OTP.
 * In `NODE_ENV=test`, if `GOROLA_TEST_OTP` is set to six digits, returns that value (integration/unit tests only).
 */
export function generateBuyerOtp(): string {
  const fixed = process.env.GOROLA_TEST_OTP?.trim();
  if (process.env.NODE_ENV === "test" && fixed !== undefined && fixed.length > 0) {
    if (!/^\d{6}$/.test(fixed)) {
      throw new Error("GOROLA_TEST_OTP must be exactly 6 digits when set");
    }
    return fixed;
  }
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
