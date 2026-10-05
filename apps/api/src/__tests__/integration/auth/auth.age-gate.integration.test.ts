import crypto from "node:crypto";

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

async function cleanAuthAgeGateDb(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe('DELETE FROM "ConsentLog";');
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

describe("Auth Age Gate Integration (8.8.4)", () => {
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
    await cleanAuthAgeGateDb(db);
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

  it("new phone: send-otp -> verify-otp returns ageGateRequired: true and ageTicket (no User created, no tokens)", async () => {
    const phone = "+919876543201";

    const sendRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/send-otp",
      payload: { phone }
    });
    expect(sendRes.statusCode).toBe(200);

    const verifyRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/verify-otp",
      payload: { phone, otp: "111222" }
    });

    expect(verifyRes.statusCode).toBe(200);
    const json = verifyRes.json();
    expect(json.data.ageGateRequired).toBe(true);
    expect(json.data.ageTicket).toMatch(/^[a-f0-9]{64}$/);
    expect(json.data.accessToken).toBeUndefined();
    expect(json.data.refreshToken).toBeUndefined();
    expect(json.data.userId).toBeUndefined();
    expect(verifyRes.headers["set-cookie"]).toBeUndefined();

    // Verify no User row in database
    const userCount = await db.user.count({
      where: { phoneHash: hashPII(phone) }
    });
    expect(userCount).toBe(0);

    // Verify Redis ticket storage: age_ticket:<sha256(ticket)>
    const ticketHash = crypto
      .createHash("sha256")
      .update(json.data.ageTicket)
      .digest("hex");
    const rawStored = await redis.get(`age_ticket:${ticketHash}`);
    expect(rawStored).not.toBeNull();
    const parsedStored = JSON.parse(rawStored!);
    expect(parsedStored.phone).toBe(phone);
    expect(parsedStored.createdAt).toBeDefined();
    expect(parsedStored.dateOfBirth).toBeUndefined();

    const ttl = await redis.ttl(`age_ticket:${ticketHash}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(600);

    // Plain ticket should never be a key in Redis
    const plainKey = await redis.get(`age_ticket:${json.data.ageTicket}`);
    expect(plainKey).toBeNull();
  });

  it("existing adult user (ageConfirmedAt set) logs in normally with tokens", async () => {
    const phone = "+919876543202";
    const user = await db.user.create({
      data: {
        name: "Existing Adult",
        phone,
        phoneHash: hashPII(phone),
        ageConfirmedAt: new Date(),
        ageConfirmedPolicyVersion: "1.1"
      }
    });

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

    expect(verifyRes.statusCode).toBe(200);
    const json = verifyRes.json();
    expect(json.data.userId).toBe(user.id);
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.ageGateRequired).toBeFalsy();
    expect(verifyRes.headers["set-cookie"]).toBeDefined();
  });

  it("legacy user without ageConfirmedAt returns ageGateRequired: true without updating row", async () => {
    const phone = "+919876543203";
    const user = await db.user.create({
      data: {
        name: "Legacy User",
        phone,
        phoneHash: hashPII(phone),
        ageConfirmedAt: null,
        ageConfirmedPolicyVersion: null
      }
    });

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

    expect(verifyRes.statusCode).toBe(200);
    const json = verifyRes.json();
    expect(json.data.ageGateRequired).toBe(true);
    expect(json.data.ageTicket).toMatch(/^[a-f0-9]{64}$/);
    expect(json.data.accessToken).toBeUndefined();

    // Verify existing user row is untouched
    const fetched = await db.user.findUnique({ where: { id: user.id } });
    expect(fetched?.ageConfirmedAt).toBeNull();
  });

  it("consuming OTP deletes the OTP key preventing replay", async () => {
    const phone = "+919876543204";

    await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/send-otp",
      payload: { phone }
    });

    const verifyRes1 = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/verify-otp",
      payload: { phone, otp: "111222" }
    });
    expect(verifyRes1.statusCode).toBe(200);

    const verifyRes2 = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/verify-otp",
      payload: { phone, otp: "111222" }
    });
    expect(verifyRes2.statusCode).toBe(401);
  });

  it("send-otp returns 403 AGE_GATE_LOCKED when phone has active lockout (no SMS is generated)", async () => {
    const phone = "+919876543205";
    const phoneHash = hashPII(phone);

    // Create active lockout
    await db.ageGateLockout.create({
      data: {
        phoneHash,
        lockedUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    });

    const sendRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/send-otp",
      payload: { phone }
    });

    expect(sendRes.statusCode).toBe(403);
    const json = sendRes.json();
    expect(json.error.code).toBe("AGE_GATE_LOCKED");

    // Verify no OTP stored in Redis
    const otpKey = await redis.get(`otp:${phone}`);
    expect(otpKey).toBeNull();
  });

  it("send-otp succeeds when phone lockout has expired", async () => {
    const phone = "+919876543206";
    const phoneHash = hashPII(phone);

    // Create expired lockout
    await db.ageGateLockout.create({
      data: {
        phoneHash,
        lockedUntil: new Date(Date.now() - 1000)
      }
    });

    const sendRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/send-otp",
      payload: { phone }
    });

    expect(sendRes.statusCode).toBe(200);
  });
});
