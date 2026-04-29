import { afterEach, describe, expect, it } from "vitest";

import { generateBuyerOtp } from "../../../modules/auth/generate-buyer-otp.js";

describe("generateBuyerOtp", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    delete process.env.GOROLA_DUMMY_OTP;
    delete process.env.GOROLA_TEST_OTP;
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("returns GOROLA_DUMMY_OTP in any environment when set", () => {
    process.env.NODE_ENV = "production";
    process.env.GOROLA_DUMMY_OTP = "123456";

    expect(generateBuyerOtp()).toBe("123456");
  });

  it("throws when GOROLA_DUMMY_OTP is not six digits", () => {
    process.env.GOROLA_DUMMY_OTP = "12345";

    expect(() => generateBuyerOtp()).toThrowError(
      "GOROLA_DUMMY_OTP must be exactly 6 digits when set"
    );
  });
});
