import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { signDeviceCookie } from "../../../modules/age-gate/age-gate-cookie.js";
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

async function cleanConfirmAgeMinorDb(db: PrismaClient): Promise<void> {
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

describe("Auth confirm-age Integration (Phase 8.8.6 — Under-18 Minor Path)", () => {
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
    await cleanConfirmAgeMinorDb(db);
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

  it("minor DOB -> HTTP 403 AGE_REQUIREMENT_NOT_MET, creates lockout and audit log, sets gorola_ag cookie", async () => {
    const phone = "+919876543230";
    const ticket = await getAgeTicket(phone);

    const confirmRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "2012-03-10",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });

    expect(confirmRes.statusCode).toBe(403);
    const json = confirmRes.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("AGE_REQUIREMENT_NOT_MET");
    expect(json.error.message).toContain("18 and over");
    expect(json.data).toBeUndefined();

    // Check Set-Cookie for gorola_ag
    const setCookie = confirmRes.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : (setCookie ?? "");
    expect(cookieHeader).toContain("gorola_ag=");
    expect(cookieHeader).toContain("HttpOnly");

    // 1. DB: User count is 0
    const userCount = await db.user.count({ where: { phoneHash: hashPII(phone) } });
    expect(userCount).toBe(0);

    // 2. DB: Exactly 1 AgeGateLockout with hashed phone
    const lockout = await db.ageGateLockout.findUnique({
      where: { phoneHash: hashPII(phone) }
    });
    expect(lockout).not.toBeNull();
    expect(lockout?.strikeCount).toBe(1);
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const diff = Math.abs(lockout!.lockedUntil.getTime() - (Date.now() + ninetyDaysMs));
    expect(diff).toBeLessThan(60000);

    const lockoutJson = JSON.stringify(lockout);
    expect(lockoutJson).not.toContain("9876543230");
    expect(lockoutJson).not.toContain("2012");

    // 3. DB: Exactly 1 AuditLog AGE_GATE_LOCKOUT_CREATED
    const auditLogs = await db.auditLog.findMany({
      where: { action: "AGE_GATE_LOCKOUT_CREATED" }
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.actorRole).toBe("SYSTEM");
    expect(auditLogs[0]?.entityType).toBe("AgeGateLockout");
    expect(auditLogs[0]?.entityId).toBe(lockout!.id);
    const auditNewValue = auditLogs[0]?.newValue as Record<string, unknown>;
    expect(Object.keys(auditNewValue).sort()).toEqual(["lockedUntil", "strikeCount"]);

    // 4. DB: Zero ConsentLog rows
    const consentCount = await db.consentLog.count();
    expect(consentCount).toBe(0);

    // 5. Replaying the same ticket fails with 401 AGE_TICKET_INVALID
    const replayRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "2012-03-10",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(replayRes.statusCode).toBe(401);
    expect(replayRes.json().error.code).toBe("AGE_TICKET_INVALID");

    // 6. Subsequent send-otp for that locked phone returns 403 AGE_GATE_LOCKED
    const sendOtpRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/send-otp",
      payload: { phone }
    });
    expect(sendOtpRes.statusCode).toBe(403);
    expect(sendOtpRes.json().error.code).toBe("AGE_GATE_LOCKED");
  });

  it("device cooling-off: valid gorola_ag cookie blocks a DIFFERENT phone even with adult DOB", async () => {
    const phoneA = "+919876543231";
    const ticketA = await getAgeTicket(phoneA);

    // Minor refusal on phoneA -> receives cookie
    const refusalRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticketA,
        dateOfBirth: "2010-05-10",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(refusalRes.statusCode).toBe(403);

    const validDeviceCookie = signDeviceCookie(new Date(), 24);

    // Phone B sends OTP & tries to confirm adult DOB with Phone A's device cookie
    const phoneB = "+919876543232";
    const ticketB = await getAgeTicket(phoneB);

    const blockedRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      headers: {
        cookie: `gorola_ag=${validDeviceCookie}`
      },
      payload: {
        ageTicket: ticketB,
        dateOfBirth: "1990-01-01",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });

    expect(blockedRes.statusCode).toBe(403);
    expect(blockedRes.json().error.code).toBe("AGE_GATE_LOCKED");

    // Phone B user was not created
    const userCountB = await db.user.count({ where: { phoneHash: hashPII(phoneB) } });
    expect(userCountB).toBe(0);

    // With an expired or tampered cookie, the adult request succeeds
    const expiredCookie = signDeviceCookie(new Date(Date.now() - 25 * 3600 * 1000), 24);
    const retryRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      headers: {
        cookie: `gorola_ag=${expiredCookie}`
      },
      payload: {
        ageTicket: ticketB, // ticket was untouched
        dateOfBirth: "1990-01-01",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(retryRes.statusCode).toBe(200);
  });

  it("increments strikeCount to 2 when an expired lockout receives a new refusal", async () => {
    const phone = "+919876543233";
    const phoneHash = hashPII(phone);

    // Pre-existing expired lockout
    await db.ageGateLockout.create({
      data: {
        phoneHash,
        lockedUntil: new Date(Date.now() - 1000),
        strikeCount: 1
      }
    });

    const ticket = await getAgeTicket(phone);
    const confirmRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "2014-07-07",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });
    expect(confirmRes.statusCode).toBe(403);

    const lockouts = await db.ageGateLockout.findMany({ where: { phoneHash } });
    expect(lockouts.length).toBe(1);
    expect(lockouts[0]?.strikeCount).toBe(2);
    expect(lockouts[0]?.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it("refusal error message is identical across different under-18 dates (no cutoff leak)", async () => {
    const phone1 = "+919876543234";
    const ticket1 = await getAgeTicket(phone1);
    const res1 = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket1,
        dateOfBirth: "2010-06-15",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });

    const phone2 = "+919876543235";
    const ticket2 = await getAgeTicket(phone2);
    const res2 = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket2,
        dateOfBirth: "2015-01-01", // 7+ years under 18
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });

    expect(res1.statusCode).toBe(403);
    expect(res2.statusCode).toBe(403);
    expect(res1.json().error).toEqual(res2.json().error);
  });
});
