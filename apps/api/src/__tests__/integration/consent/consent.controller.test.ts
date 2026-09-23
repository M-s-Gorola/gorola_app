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

// ---------------------------------------------------------------------------
// Idempotency tests (Section 10 — DPDP_CONSENT_ARCHITECTURE_GUIDE.md)
// ---------------------------------------------------------------------------
describe("Consent idempotency guard (DPDP Section 10)", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanConsentTestGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it(
    "POST /api/v1/consent returns 200 and does NOT create a duplicate row " +
    "when an active same-version record already exists for the same purpose",
    async () => {
      process.env.GOROLA_TEST_OTP = "111222";
      const server = createServer({
        disableRedis: true,
        registerRoutes: registerAppRoutes
      });

      const phone = "+919876500001";
      const { accessToken, userId } = await getBuyerAccessToken(server, phone);

      const payload = {
        consentVersion: "1.0",
        noticeText: "We collect your phone number to send a one-time password.",
        purpose: "OTP_AUTH"
      };

      // First POST — should create a new row and return 201
      const firstRes = await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "POST",
        payload,
        url: "/api/v1/consent"
      });
      expect(firstRes.statusCode).toBe(201);

      // Second POST — same purpose + version, record is already active
      // Should short-circuit and return 200 without writing a new row
      const secondRes = await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "POST",
        payload,
        url: "/api/v1/consent"
      });
      expect(secondRes.statusCode).toBe(200);

      // Third POST — another duplicate, still 200
      const thirdRes = await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "POST",
        payload,
        url: "/api/v1/consent"
      });
      expect(thirdRes.statusCode).toBe(200);

      // DB must have exactly ONE row for this user + purpose
      const rows = await db.consentLog.findMany({ where: { purpose: "OTP_AUTH", userId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.isWithdrawn).toBe(false);

      // All three responses should return the same consent record id
      const firstId = (firstRes.json() as { data: { id: string } }).data.id;
      const secondId = (secondRes.json() as { data: { id: string } }).data.id;
      const thirdId = (thirdRes.json() as { data: { id: string } }).data.id;
      expect(secondId).toBe(firstId);
      expect(thirdId).toBe(firstId);
    }
  );

  it(
    "POST /api/v1/consent creates a NEW row (returns 201) after the user " +
    "has withdrawn consent — re-grant must not be blocked by the idempotency guard",
    async () => {
      process.env.GOROLA_TEST_OTP = "111222";
      const server = createServer({
        disableRedis: true,
        registerRoutes: registerAppRoutes
      });

      const phone = "+919876500002";
      const { accessToken, userId } = await getBuyerAccessToken(server, phone);

      const payload = {
        consentVersion: "1.0",
        noticeText: "Marketing emails opt-in.",
        purpose: "MARKETING_EMAIL"
      };

      // Grant consent
      const grantRes = await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "POST",
        payload,
        url: "/api/v1/consent"
      });
      expect(grantRes.statusCode).toBe(201);
      const firstId = (grantRes.json() as { data: { id: string } }).data.id;

      // Withdraw consent
      await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "DELETE",
        url: "/api/v1/consent/MARKETING_EMAIL"
      });

      // Re-grant after withdrawal — idempotency guard checks isWithdrawn,
      // so it must let this through and create a new row
      const regrantRes = await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "POST",
        payload,
        url: "/api/v1/consent"
      });
      expect(regrantRes.statusCode).toBe(201);
      const secondId = (regrantRes.json() as { data: { id: string } }).data.id;

      // Two rows: original (withdrawn) + new re-grant
      expect(secondId).not.toBe(firstId);

      const rows = await db.consentLog.findMany({
        orderBy: { createdAt: "asc" },
        where: { purpose: "MARKETING_EMAIL", userId }
      });
      expect(rows).toHaveLength(2);
      expect(rows[0]?.isWithdrawn).toBe(true);
      expect(rows[1]?.isWithdrawn).toBe(false);
    }
  );

  it(
    "POST /api/v1/consent creates a NEW row (returns 201) when consentVersion bumps " +
    "even if an active v1.0 record exists — policy version change triggers re-consent",
    async () => {
      process.env.GOROLA_TEST_OTP = "111222";
      const server = createServer({
        disableRedis: true,
        registerRoutes: registerAppRoutes
      });

      const phone = "+919876500003";
      const { accessToken, userId } = await getBuyerAccessToken(server, phone);

      // Grant v1.0
      const v1Res = await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "POST",
        payload: {
          consentVersion: "1.0",
          noticeText: "Original v1.0 notice.",
          purpose: "ORDER_PROCESSING"
        },
        url: "/api/v1/consent"
      });
      expect(v1Res.statusCode).toBe(201);

      // Grant v2.0 (policy version bump) — must create a new row
      const v2Res = await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "POST",
        payload: {
          consentVersion: "2.0",
          noticeText: "Updated v2.0 notice with new sub-processor.",
          purpose: "ORDER_PROCESSING"
        },
        url: "/api/v1/consent"
      });
      expect(v2Res.statusCode).toBe(201);

      // Two distinct rows: v1.0 and v2.0
      const rows = await db.consentLog.findMany({
        orderBy: { createdAt: "asc" },
        where: { purpose: "ORDER_PROCESSING", userId }
      });
      expect(rows).toHaveLength(2);
      expect(rows[0]?.consentVersion).toBe("1.0");
      expect(rows[1]?.consentVersion).toBe("2.0");

      // Another call with v2.0 — idempotency guard should now short-circuit on v2.0
      const v2DupeRes = await server.inject({
        headers: { authorization: `Bearer ${accessToken}` },
        method: "POST",
        payload: {
          consentVersion: "2.0",
          noticeText: "Updated v2.0 notice with new sub-processor.",
          purpose: "ORDER_PROCESSING"
        },
        url: "/api/v1/consent"
      });
      expect(v2DupeRes.statusCode).toBe(200);

      // Still exactly two rows
      const rowsAfter = await db.consentLog.findMany({
        where: { purpose: "ORDER_PROCESSING", userId }
      });
      expect(rowsAfter).toHaveLength(2);
    }
  );
});
