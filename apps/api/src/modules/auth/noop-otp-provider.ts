import type { OtpProvider } from "./auth.types.js";

/**
 * Stub SMS sender for development and CI. Swap for Fast2SMS (DECISION-006) behind the same {@link OtpProvider} interface.
 */
export function createNoopOtpProvider(): OtpProvider {
  return {
    sendOtp: async () => {
      return;
    }
  };
}
