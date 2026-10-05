import { CONSENT_NOTICES } from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

type MockRedis = {
  _store: Map<string, string>;
  del: (...keys: string[]) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  keys: (pattern: string) => Promise<string[]>;
  set: (key: string, value: string, mode?: string, ttl?: number) => Promise<string>;
  ttl: (key: string) => Promise<number>;
};

function createMockRedis(): MockRedis {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    _store: store,
    del: async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
        ttls.delete(k);
      }
      return count;
    },
    get: async (key: string) => store.get(key) ?? null,
    keys: async (pattern: string) => {
      const prefix = pattern.replace("*", "");
      return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    },
    set: async (key: string, value: string, _mode?: string, ttl?: number) => {
      store.set(key, value);
      if (ttl) ttls.set(key, ttl);
      return "OK";
    },
    ttl: async (key: string) => ttls.get(key) ?? -1
  };
}

async function cleanConfirmAgeDb(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe('DELETE FROM "ConsentLog";');
  await db.$executeRawUnsafe('DELETE FROM "AuditLog";');
  await db.ageGateLockout.deleteMany();
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("Auth confirm-age Integration (Phase 8.8.5 — Adult Path)", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let redis: MockRedis;

  beforeAll(() => {
    process.env.GOROLA_TEST_OTP = "111222";
  });

  afterAll(async () => {
    delete process.env.GOROLA_TEST_OTP;
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanConfirmAgeDb(db);
    redis = createMockRedis();
    server = createServer();
    (server as unknown as { redis: MockRedis }).redis = redis;
    registerAppRoutes(server);
    await server.ready();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  async function getAgeTicket(phone: string): Promise<string> {
    await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/send-otp",
      payload: { phone }
    });
    const verifyRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/verify-otp",
      payload: { phone, otp: "111222" }
    });
    return verifyRes.json().data.ageTicket;
  }

  it("valid ticket + adult DOB -> creates user, logs 2 consents & 1 audit, returns tokens + cookie", async () => {
    const phone = "+919876543220";
    const ticket = await getAgeTicket(phone);

    const confirmRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "1990-05-14",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });

    expect(confirmRes.statusCode).toBe(200);
    const json = confirmRes.json();
    expect(json.success).toBe(true);
    expect(typeof json.data.accessToken).toBe("string");
    expect(typeof json.data.userId).toBe("string");
    expect(json.data.privacyPolicyVersionAccepted).toBe("1.1");
    expect(json.data.ageGateRequired).toBe(false);
    expect(confirmRes.headers["set-cookie"]).toBeDefined();

    // 1. Verify DB: User record
    const user = await db.user.findUnique({
      where: { phoneHash: hashPII(phone) }
    });
    expect(user).not.toBeNull();
    expect(user?.isVerified).toBe(true);
    expect(user?.ageConfirmedPolicyVersion).toBe("1.1");
    expect(user?.privacyPolicyVersionAccepted).toBe("1.1");
    expect(user?.ageConfirmedAt).not.toBeNull();
    expect(Date.now() - new Date(user!.ageConfirmedAt!).getTime()).toBeLessThan(10000);

    // 2. Verify DB: 2 ConsentLog rows with canonical server text
    const consents = await db.consentLog.findMany({
      where: { userId: user!.id },
      orderBy: { purpose: "asc" }
    });
    expect(consents.length).toBe(2);

    const ageDeclarationConsent = consents.find((c) => c.purpose === "AGE_DECLARATION");
    expect(ageDeclarationConsent).toBeDefined();
    expect(ageDeclarationConsent?.consentVersion).toBe("1.1");
    expect(ageDeclarationConsent?.noticeText).toBe(CONSENT_NOTICES.AGE_DECLARATION["1.1"]);

    const otpAuthConsent = consents.find((c) => c.purpose === "OTP_AUTH");
    expect(otpAuthConsent).toBeDefined();
    expect(otpAuthConsent?.consentVersion).toBe("1.1");
    expect(otpAuthConsent?.noticeText).toBe(CONSENT_NOTICES.OTP_AUTH["1.1"]);

    // 3. Verify DB: 1 AuditLog row
    const auditLogs = await db.auditLog.findMany({
      where: { entityId: user!.id, action: "AGE_CONFIRMED" }
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.actorRole).toBe("BUYER");
    expect(JSON.stringify(auditLogs[0]?.newValue)).not.toMatch(/birth|dob/i);

    // 4. DOB Never Persists Guarantee
    const fullUserJson = JSON.stringify(user);
    const fullConsentJson = JSON.stringify(consents);
    const fullAuditJson = JSON.stringify(auditLogs);
    expect(fullUserJson).not.toContain("1990-05-14");
    expect(fullConsentJson).not.toContain("1990-05-14");
    expect(fullAuditJson).not.toContain("1990-05-14");

    // Scan Redis keys/values
    for (const [key, val] of redis._store.entries()) {
      expect(key).not.toContain("1990-05-14");
      expect(val).not.toContain("1990-05-14");
    }
  });

  it("replaying the same ticket returns 401 AGE_TICKET_INVALID", async () => {
    const phone = "+919876543221";
    const ticket = await getAgeTicket(phone);

    const firstRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "1992-08-20",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(firstRes.statusCode).toBe(200);

    const secondRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "1992-08-20",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(secondRes.statusCode).toBe(401);
    expect(secondRes.json().error.code).toBe("AGE_TICKET_INVALID");

    const userCount = await db.user.count({ where: { phoneHash: hashPII(phone) } });
    expect(userCount).toBe(1);
  });

  it("handles race condition with concurrent requests on same ticket gracefully", async () => {
    const phone = "+919876543222";
    const ticket = await getAgeTicket(phone);

    const [res1, res2] = await Promise.all([
      server.inject({
        method: "POST",
        url: "/api/v1/auth/buyer/confirm-age",
        payload: {
          ageTicket: ticket,
          dateOfBirth: "1994-01-10",
          acknowledgedNotice: true,
          consentVersion: "1.1"
        }
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/auth/buyer/confirm-age",
        payload: {
          ageTicket: ticket,
          dateOfBirth: "1994-01-10",
          acknowledgedNotice: true,
          consentVersion: "1.1"
        }
      })
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    expect(statusCodes).toEqual([200, 401]);

    const userCount = await db.user.count({ where: { phoneHash: hashPII(phone) } });
    expect(userCount).toBe(1);
  });

  it("invalid payload returns 400 VALIDATION_ERROR and leaves ticket usable for subsequent retry", async () => {
    const phone = "+919876543223";
    const ticket = await getAgeTicket(phone);

    const invalidBodies = [
      { dateOfBirth: "2010-02-30", acknowledgedNotice: true, consentVersion: "1.1" },
      { dateOfBirth: "2099-01-01", acknowledgedNotice: true, consentVersion: "1.1" },
      { dateOfBirth: "1899-01-01", acknowledgedNotice: true, consentVersion: "1.1" },
      { dateOfBirth: "not-a-date", acknowledgedNotice: true, consentVersion: "1.1" },
      { acknowledgedNotice: true, consentVersion: "1.1" },
      { dateOfBirth: "1990-01-01", acknowledgedNotice: false, consentVersion: "1.1" },
      { dateOfBirth: "1990-01-01", acknowledgedNotice: true, consentVersion: "9.9" }
    ];

    for (const body of invalidBodies) {
      const res = await server.inject({
        method: "POST",
        url: "/api/v1/auth/buyer/confirm-age",
        payload: {
          ageTicket: ticket,
          ...body
        }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    }

    // After all invalid attempts, ticket must still be usable
    const validRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "1990-01-01",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(validRes.statusCode).toBe(200);
  });

  it("invalid ticket format returns 400 and unknown 64-hex ticket returns 401 AGE_TICKET_INVALID", async () => {
    const badFormatRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: "invalid_format_short",
        dateOfBirth: "1990-01-01",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(badFormatRes.statusCode).toBe(400);
    expect(badFormatRes.json().error.code).toBe("VALIDATION_ERROR");

    const unknownTicketRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        dateOfBirth: "1990-01-01",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(unknownTicketRes.statusCode).toBe(401);
    expect(unknownTicketRes.json().error.code).toBe("AGE_TICKET_INVALID");
  });
});
