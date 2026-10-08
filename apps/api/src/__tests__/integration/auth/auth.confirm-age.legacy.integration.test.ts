import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { encryptPII, hashPII } from "../../../lib/crypto.js";
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

async function cleanConfirmAgeLegacyDb(db: PrismaClient): Promise<void> {
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

describe("Auth confirm-age Integration (Phase 8.8.7 — Existing Legacy Users & Underage Purge)", () => {
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
    await cleanConfirmAgeLegacyDb(db);
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

  it("legacy user + adult DOB -> HTTP 200 with same userId, updates ageConfirmedAt, adds AGE_DECLARATION consent and audit", async () => {
    const phone = "+919876543250";
    const phoneHash = hashPII(phone);

    // 1. Create legacy user with ageConfirmedAt: null
    const legacyUser = await db.user.create({
      data: {
        phone: encryptPII(phone),
        phoneHash,
        name: "Rahul Sharma",
        isVerified: true,
        isActive: true,
        ageConfirmedAt: null,
        privacyPolicyVersionAccepted: "1.0"
      }
    });

    // 2. Add existing OTP_AUTH consent from earlier
    await db.consentLog.create({
      data: {
        userId: legacyUser.id,
        purpose: "OTP_AUTH",
        consentVersion: "1.0",
        noticeText: "Legacy notice text"
      }
    });

    const ticket = await getAgeTicket(phone);

    // 3. Confirm adult age
    const confirmRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "1994-06-15",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });

    expect(confirmRes.statusCode).toBe(200);
    const json = confirmRes.json();
    expect(json.success).toBe(true);
    expect(json.data.userId).toBe(legacyUser.id);
    expect(json.data.name).toBe("Rahul Sharma");
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();

    // 4. DB checks
    const updatedUser = await db.user.findUnique({ where: { id: legacyUser.id } });
    expect(updatedUser?.ageConfirmedAt).not.toBeNull();
    expect(updatedUser?.ageConfirmedPolicyVersion).toBe("1.1");
    expect(updatedUser?.privacyPolicyVersionAccepted).toBe("1.1");

    // Total users in DB is still 1
    const totalUsers = await db.user.count();
    expect(totalUsers).toBe(1);

    // Consents: Exactly 1 OTP_AUTH and 1 AGE_DECLARATION
    const consents = await db.consentLog.findMany({ where: { userId: legacyUser.id } });
    expect(consents.length).toBe(2);
    expect(consents.map((c) => c.purpose).sort()).toEqual(["AGE_DECLARATION", "OTP_AUTH"]);

    // AuditLog: AGE_CONFIRMED entry created
    const audit = await db.auditLog.findFirst({
      where: { action: "AGE_CONFIRMED", entityId: legacyUser.id }
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorRole).toBe("BUYER");
  });

  it("legacy user + under-18 DOB -> HTTP 403, immediately permanently purges user and creates lockout for phoneHash", async () => {
    const phone = "+919876543251";
    const phoneHash = hashPII(phone);

    // 1. Create legacy user with address
    const legacyUser = await db.user.create({
      data: {
        phone: encryptPII(phone),
        phoneHash,
        name: "Minor User",
        isVerified: true,
        isActive: true,
        ageConfirmedAt: null,
        privacyPolicyVersionAccepted: "1.0"
      }
    });

    await db.address.create({
      data: {
        userId: legacyUser.id,
        label: "HOME",
        flatRoom: "Flat 101",
        landmarkDescription: "Near Mall Road",
        lat: 30.4598,
        lng: 78.0644
      }
    });

    const ticket = await getAgeTicket(phone);

    // 2. Confirm under-18 age
    const confirmRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "2013-04-01",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });

    expect(confirmRes.statusCode).toBe(403);
    expect(confirmRes.json().error.code).toBe("AGE_REQUIREMENT_NOT_MET");

    // 3. User row is permanently purged & anonymized
    const purgedUser = await db.user.findUnique({ where: { id: legacyUser.id } });
    expect(purgedUser?.name).toBe("[deleted]");
    expect(purgedUser?.phone).toBe(`DELETED_${legacyUser.id}`);
    expect(purgedUser?.phoneHash).toBeNull();
    expect(purgedUser?.isActive).toBe(false);
    expect(purgedUser?.isDeleted).toBe(true);

    // Addresses purged
    const addresses = await db.address.findMany({ where: { userId: legacyUser.id } });
    expect(addresses.length).toBe(0);

    // Lockout exists for pre-purge phone hash
    const lockout = await db.ageGateLockout.findUnique({ where: { phoneHash } });
    expect(lockout).not.toBeNull();
    expect(lockout?.strikeCount).toBe(1);
  });

  it("legacy user in 30-day deletion grace + adult DOB -> HTTP 200 with isPendingDeletion true, reactivate succeeds", async () => {
    const phone = "+919876543252";
    const phoneHash = hashPII(phone);

    // User in deletion grace
    const scheduledDeletion = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const legacyUser = await db.user.create({
      data: {
        phone: encryptPII(phone),
        phoneHash,
        name: "Pending Reactivation",
        isVerified: true,
        isActive: true,
        ageConfirmedAt: null,
        deletedAt: new Date(),
        deletionScheduledFor: scheduledDeletion,
        privacyPolicyVersionAccepted: "1.0"
      }
    });

    const ticket = await getAgeTicket(phone);

    const confirmRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/confirm-age",
      payload: {
        ageTicket: ticket,
        dateOfBirth: "1988-12-12",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      }
    });

    expect(confirmRes.statusCode).toBe(200);
    const json = confirmRes.json();
    expect(json.data.isPendingDeletion).toBe(true);
    expect(json.data.deletionScheduledFor).toBe(scheduledDeletion.toISOString());

    // Reactivation endpoint succeeds with the access token
    const reactivateRes = await server.inject({
      method: "POST",
      url: "/api/v1/user/reactivate-account",
      headers: {
        authorization: `Bearer ${json.data.accessToken}`
      }
    });

    expect(reactivateRes.statusCode).toBe(200);
    const reactivatedUser = await db.user.findUnique({ where: { id: legacyUser.id } });
    expect(reactivatedUser?.deletedAt).toBeNull();
    expect(reactivatedUser?.deletionScheduledFor).toBeNull();
  });

  it("POST /api/v1/auth/buyer/refresh: unconfirmed user (ageConfirmedAt = null) -> 403 AGE_CONFIRMATION_REQUIRED, confirmed -> 200", async () => {
    const phone = "+919876543253";
    const phoneHash = hashPII(phone);

    // Create unconfirmed user
    const unconfirmedUser = await db.user.create({
      data: {
        phone: encryptPII(phone),
        phoneHash,
        name: "Unconfirmed User",
        isVerified: true,
        isActive: true,
        ageConfirmedAt: null,
        privacyPolicyVersionAccepted: "1.0"
      }
    });

    // Seed session in redis
    const refreshToken = "test-legacy-rt-unconfirmed";
    await redis.set(
      `rt:${refreshToken}`,
      JSON.stringify({ userId: unconfirmedUser.id, phone, name: "Unconfirmed User" })
    );
    await redis.set(
      `user_sessions:${unconfirmedUser.id}`,
      JSON.stringify([
        {
          sessionId: "s-1",
          refreshToken,
          ipAddress: "127.0.0.1",
          userAgent: "test",
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        }
      ])
    );

    const refreshRes1 = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/refresh",
      payload: { refreshToken }
    });

    expect(refreshRes1.statusCode).toBe(403);
    expect(refreshRes1.json().error.code).toBe("AGE_CONFIRMATION_REQUIRED");

    // Update user to confirmed
    await db.user.update({
      where: { id: unconfirmedUser.id },
      data: {
        ageConfirmedAt: new Date(),
        ageConfirmedPolicyVersion: "1.1",
        privacyPolicyVersionAccepted: "1.1"
      }
    });

    const refreshToken2 = "test-legacy-rt-confirmed";
    await redis.set(
      `rt:${refreshToken2}`,
      JSON.stringify({ userId: unconfirmedUser.id, phone, name: "Confirmed User" })
    );

    const refreshRes2 = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/refresh",
      payload: { refreshToken: refreshToken2 }
    });

    expect(refreshRes2.statusCode).toBe(200);
    expect(refreshRes2.json().data.accessToken).toBeDefined();
  });
});
