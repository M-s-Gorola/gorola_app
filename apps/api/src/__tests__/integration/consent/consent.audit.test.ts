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

async function cleanConsentAuditTestGraph(db: PrismaClient): Promise<void> {
  await db.auditLog.deleteMany();
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

describe("Consent Audit & Immutability (DPDP 8.2.4)", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanConsentAuditTestGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("POST /api/v1/consent creates an AuditLog row with action = 'CONSENT_GIVEN'", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919876543220";
    const { accessToken, userId } = await getBuyerAccessToken(server, phone);

    const res = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        consentVersion: "1.0",
        noticeText: "We collect your phone number for OTP authentication.",
        purpose: "OTP_AUTH"
      },
      url: "/api/v1/consent"
    });
    expect(res.statusCode).toBe(201);

    const auditLogs = await db.auditLog.findMany({
      where: {
        action: "CONSENT_GIVEN",
        actorId: userId,
        entityType: "ConsentLog"
      }
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]!.actorRole).toBe("BUYER");
  });

  it("DELETE /api/v1/consent/:purpose creates an AuditLog row with action = 'CONSENT_WITHDRAWN'", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919876543221";
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

    const auditLogs = await db.auditLog.findMany({
      where: {
        action: "CONSENT_WITHDRAWN",
        actorId: userId,
        entityType: "ConsentLog"
      }
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]!.actorRole).toBe("BUYER");
  });

  it("direct call to prisma.consentLog.delete or deleteMany is blocked by immutability guard", async () => {
    const user = await db.user.create({
      data: {
        name: "Consent Immutability Test User",
        phone: "+919876543222"
      }
    });

    const consent = await db.consentLog.create({
      data: {
        consentVersion: "1.0",
        noticeText: "Analytics tracking",
        purpose: "ANALYTICS",
        userId: user.id
      }
    });

    // Attempting delete should throw CONSENT_LOG_IMMUTABLE AppError
    await expect(
      db.consentLog.delete({
        where: { id: consent.id }
      })
    ).rejects.toThrow("CONSENT_LOG_IMMUTABLE");

    await expect(
      db.consentLog.deleteMany({
        where: { userId: user.id }
      })
    ).rejects.toThrow("CONSENT_LOG_IMMUTABLE");
  });
});
