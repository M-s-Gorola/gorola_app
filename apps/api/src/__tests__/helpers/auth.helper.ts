import type { createServer } from "../../server.js";

export interface LoginBuyerResult {
  accessToken: string;
  refreshToken?: string | undefined;
  userId?: string | undefined;
  phone?: string | undefined;
  name?: string | null | undefined;
}

/**
 * Standard test helper to log in a buyer through OTP and complete the Age Gate (if new buyer)
 * using the DPDP Act 2023 compliant two-step flow.
 */
export async function loginBuyer(
  server: ReturnType<typeof createServer>,
  phone: string,
  dob = "1990-01-01"
): Promise<LoginBuyerResult> {
  const testOtp = process.env.GOROLA_TEST_OTP || "111222";

  // 1. Send OTP
  await server.inject({
    method: "POST",
    payload: { phone },
    url: "/api/v1/auth/buyer/send-otp"
  });

  // 2. Verify OTP
  const verifyRes = await server.inject({
    method: "POST",
    payload: { otp: testOtp, phone },
    url: "/api/v1/auth/buyer/verify-otp"
  });

  const verifyJson = verifyRes.json() as {
    data?: {
      accessToken?: string;
      refreshToken?: string;
      userId?: string;
      phone?: string;
      name?: string | null;
      ageGateRequired?: boolean;
      ageTicket?: string;
    };
    success?: boolean;
  };

  // If age gate is required (new user or legacy unconfirmed), complete confirm-age
  if (verifyJson.data?.ageGateRequired && verifyJson.data?.ageTicket) {
    const confirmRes = await server.inject({
      method: "POST",
      payload: {
        ageTicket: verifyJson.data.ageTicket,
        dateOfBirth: dob,
        acknowledgedNotice: true,
        consentVersion: "1.1"
      },
      url: "/api/v1/auth/buyer/confirm-age"
    });

    const confirmJson = confirmRes.json() as {
      data?: {
        accessToken: string;
        refreshToken?: string;
        userId?: string;
        phone?: string;
        name?: string | null;
      };
      success?: boolean;
    };

    return {
      accessToken: confirmJson.data?.accessToken ?? "",
      refreshToken: confirmJson.data?.refreshToken,
      userId: confirmJson.data?.userId,
      phone: confirmJson.data?.phone,
      name: confirmJson.data?.name
    };
  }

  return {
    accessToken: verifyJson.data?.accessToken ?? "",
    refreshToken: verifyJson.data?.refreshToken,
    userId: verifyJson.data?.userId,
    phone: verifyJson.data?.phone,
    name: verifyJson.data?.name
  };
}
