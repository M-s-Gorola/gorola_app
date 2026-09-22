import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function getBuyerAccessToken(
  server: ReturnType<typeof createServer>,
  phone: string
): Promise<{ accessToken: string; userId: string }> {
  await server.inject({
    method: "POST",
    payload: { phone },
    url: "/api/v1/auth/buyer/send-otp"
  });
  const verifyRes = await server.inject({
    method: "POST",
    payload: { otp: "111222", phone },
    url: "/api/v1/auth/buyer/verify-otp"
  });
  expect(verifyRes.statusCode).toBe(200);
  const json = verifyRes.json() as { data: { accessToken: string; userId: string } };
  return { accessToken: json.data.accessToken, userId: json.data.userId };
}

async function cleanConsentTestGraph(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe('DELETE FROM "ConsentLog";');
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("Consent API (DPDP 8.2.1)", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanConsentTestGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("POST /api/v1/consent records consent and returns 201 with consent record", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919876543210";
    const { accessToken, userId } = await getBuyerAccessToken(server, phone);

    const res = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        consentVersion: "1.0",
        noticeText: "We collect your phone number to send a one-time password.",
        purpose: "OTP_AUTH"
      },
      url: "/api/v1/consent"
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      data: { consentVersion: string; id: string; purpose: string };
      success: boolean;
    };
    expect(body.success).toBe(true);
    expect(body.data.purpose).toBe("OTP_AUTH");
    expect(body.data.consentVersion).toBe("1.0");
    expect(body.data.id).toBeDefined();

    // Verify DB
    const consents = await db.consentLog.findMany({
      where: { userId }
    });
    expect(consents).toHaveLength(1);
    expect(consents[0]?.purpose).toBe("OTP_AUTH");
    expect(consents[0]?.isWithdrawn).toBe(false);
    expect(consents[0]?.ipAddress).toBeDefined();
  });

  it("GET /api/v1/consent returns list of user consent records", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919876543211";
    const { accessToken } = await getBuyerAccessToken(server, phone);

    // Record two consents
    await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        consentVersion: "1.0",
        noticeText: "We collect phone for OTP",
        purpose: "OTP_AUTH"
      },
      url: "/api/v1/consent"
    });

    await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        consentVersion: "1.0",
        noticeText: "We collect email for marketing updates",
        purpose: "MARKETING_EMAIL"
      },
      url: "/api/v1/consent"
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: "/api/v1/consent"
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: { consents: Array<{ purpose: string }> };
      success: boolean;
    };
    expect(body.success).toBe(true);
    expect(body.data.consents).toHaveLength(2);
    const purposes = body.data.consents.map((c) => c.purpose);
    expect(purposes).toContain("OTP_AUTH");
    expect(purposes).toContain("MARKETING_EMAIL");
  });

  it("DELETE /api/v1/consent/:purpose withdraws non-essential consent", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919876543212";
    const { accessToken, userId } = await getBuyerAccessToken(server, phone);

    await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        consentVersion: "1.0",
        noticeText: "Marketing emails",
        purpose: "MARKETING_EMAIL"
      },
      url: "/api/v1/consent"
    });

    const deleteRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "DELETE",
      url: "/api/v1/consent/MARKETING_EMAIL"
    });

    expect(deleteRes.statusCode).toBe(200);
    const body = deleteRes.json() as { success: boolean };
    expect(body.success).toBe(true);

    const consent = await db.consentLog.findFirst({
      where: { purpose: "MARKETING_EMAIL", userId }
    });
    expect(consent?.isWithdrawn).toBe(true);
    expect(consent?.withdrawnAt).not.toBeNull();
  });

  it("DELETE /api/v1/consent/:purpose rejects withdrawing essential consent with 400", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919876543213";
    const { accessToken } = await getBuyerAccessToken(server, phone);

    await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        consentVersion: "1.0",
        noticeText: "Essential OTP auth",
        purpose: "OTP_AUTH"
      },
      url: "/api/v1/consent"
    });

    const deleteRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "DELETE",
      url: "/api/v1/consent/OTP_AUTH"
    });

    expect(deleteRes.statusCode).toBe(400);
    const body = deleteRes.json() as {
      error: { code: string };
      success: boolean;
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CANNOT_WITHDRAW_ESSENTIAL_CONSENT");
  });
});
