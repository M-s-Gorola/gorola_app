import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { encryptPII, hashPII } from "../../../lib/crypto.js";
import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { AgeGateRepository } from "../../../modules/age-gate/age-gate.repository.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function generateAccessToken(
  userId: string,
  role: "ADMIN" | "BUYER" | "STORE_OWNER"
): Promise<string> {
  const keys = resolveBuyerJwtKeyPair();
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keys.privateKey);
}

async function cleanDatabase(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.$executeRawUnsafe('DELETE FROM "ConsentLog";');
  await db.auditLog.deleteMany();
  await db.ageGateLockout.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.admin.deleteMany();
}

describe("Admin Age Gate Dashboard Integration Tests (8.8.14)", () => {
  const db = getPrismaClient();
  const ageGateRepo = new AgeGateRepository(db);
  let server: FastifyInstance;
  let inMemoryRedisStore: Map<string, string>;

  beforeAll(() => {
    inMemoryRedisStore = new Map<string, string>();
    const redisMock = {
      del: async (key: string) => Number(inMemoryRedisStore.delete(key)),
      get: async (key: string) => inMemoryRedisStore.get(key) ?? null,
      set: async (key: string, value: string) => {
        inMemoryRedisStore.set(key, value);
      },
      keys: async (pattern: string) => {
        const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
        return Array.from(inMemoryRedisStore.keys()).filter((k) => regex.test(k));
      }
    };

    server = createServer({
      disableRedis: true,
      registerRoutes: (app) => {
        (app as unknown as { redis: typeof redisMock }).redis = redisMock;
        registerAppRoutes(app);
      }
    });
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    inMemoryRedisStore.clear();
    await cleanDatabase(db);
  });

  describe("POST /api/v1/admin/age-gate/lookup", () => {
    const testPhone = "+919876543210";

    it("lookup with active lock returns lockout card, account null, and daysRemaining between 89 and 90 without phone digits in response", async () => {
      const admin = await db.admin.create({
        data: {
          email: "admin-lookup@gorola.in",
          passwordHash: "hash"
        }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      // Seed active lockout
      const phoneHash = hashPII(testPhone);
      await ageGateRepo.upsertLock(phoneHash, new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { phone: testPhone }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.lockout).not.toBeNull();
      expect(json.data.lockout.isActive).toBe(true);
      expect(json.data.lockout.strikeCount).toBe(1);
      expect(json.data.lockout.daysRemaining).toBeGreaterThanOrEqual(89);
      expect(json.data.lockout.daysRemaining).toBeLessThanOrEqual(90);
      expect(json.data.account).toBeNull();

      // Privacy: raw phoneHash and plain phone number are never exposed
      expect(response.body).not.toContain(phoneHash);
      expect(response.body).not.toContain("9876543210");

      // Audit log: exactly 1 AGE_GATE_LOOKUP row
      const auditLogs = await db.auditLog.findMany({
        where: { action: "AGE_GATE_LOOKUP" }
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]?.actorRole).toBe("ADMIN");
      expect(auditLogs[0]?.actorId).toBe(admin.id);
      expect(auditLogs[0]?.newValue).toEqual({
        foundLockout: true,
        foundAccount: false
      });
      expect(JSON.stringify(auditLogs[0])).not.toContain("9876543210");
    });

    it("lookup with expired lock returns lockout.isActive = false and daysRemaining = 0", async () => {
      const admin = await db.admin.create({
        data: {
          email: "admin-lookup-expired@gorola.in",
          passwordHash: "hash"
        }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      const phoneHash = hashPII(testPhone);
      await db.ageGateLockout.create({
        data: {
          phoneHash,
          lockedUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
          strikeCount: 1
        }
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { phone: testPhone }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.data.lockout.isActive).toBe(false);
      expect(json.data.lockout.daysRemaining).toBe(0);
      expect(json.data.account).toBeNull();
    });

    it("lookup with live account returns status ACTIVE, maskedPhone, ordersCount, ageConfirmedAt and lockout null", async () => {
      const admin = await db.admin.create({
        data: {
          email: "admin-lookup-account@gorola.in",
          passwordHash: "hash"
        }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      const ageConfirmedAt = new Date("2026-10-05T12:00:00Z");
      const user = await db.user.create({
        data: {
          phone: encryptPII(testPhone),
          phoneHash: hashPII(testPhone),
          name: "Vikram Sharma",
          isVerified: true,
          isActive: true,
          ageConfirmedAt,
          ageConfirmedPolicyVersion: "1.1"
        }
      });

      // Seed store + 2 orders for user
      const store = await db.store.create({
        data: {
          name: "Test Store",
          description: "Test Store Description",
          phone: "+919999000001",
          address: "Mall Road"
        }
      });

      await db.order.createMany({
        data: [
          {
            userId: user.id,
            storeId: store.id,
            total: 200,
            subtotal: 170,
            deliveryFee: 30,
            paymentMethod: "UPI",
            landmarkDescription: "Near Clock Tower"
          },
          {
            userId: user.id,
            storeId: store.id,
            total: 350,
            subtotal: 320,
            deliveryFee: 30,
            paymentMethod: "COD",
            landmarkDescription: "Mall Road Post Office"
          }
        ]
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { phone: testPhone }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.data.lockout).toBeNull();
      expect(json.data.account).not.toBeNull();
      expect(json.data.account.name).toBe("Vikram Sharma");
      expect(json.data.account.status).toBe("ACTIVE");
      expect(json.data.account.ordersCount).toBe(2);
      expect(json.data.account.ageConfirmedAt).toBe(ageConfirmedAt.toISOString());
      expect(json.data.account.maskedPhone).toContain("3210");
      expect(json.data.account.maskedPhone).not.toContain("987654");
    });

    it("lookup status mapping: suspended user -> SUSPENDED, pending deletion -> PENDING_DELETION", async () => {
      const admin = await db.admin.create({
        data: { email: "admin-status@gorola.in", passwordHash: "hash" }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      // Suspended user
      const suspendedPhone = "+919876543201";
      await db.user.create({
        data: {
          phone: encryptPII(suspendedPhone),
          phoneHash: hashPII(suspendedPhone),
          name: "Suspended User",
          isActive: false,
          isVerified: true
        }
      });

      const res1 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { phone: suspendedPhone }
      });
      expect(JSON.parse(res1.body).data.account.status).toBe("SUSPENDED");

      // Pending deletion user
      const pendingPhone = "+919876543202";
      await db.user.create({
        data: {
          phone: encryptPII(pendingPhone),
          phoneHash: hashPII(pendingPhone),
          name: "Pending Deletion User",
          isActive: true,
          isVerified: true,
          deletedAt: new Date(),
          deletionScheduledFor: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
        }
      });

      const res2 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { phone: pendingPhone }
      });
      expect(JSON.parse(res2.body).data.account.status).toBe("PENDING_DELETION");
    });

    it("lookup with unknown number returns 200 with { lockout: null, account: null }", async () => {
      const admin = await db.admin.create({
        data: { email: "admin-unknown@gorola.in", passwordHash: "hash" }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { phone: "+919999999999" }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.data.lockout).toBeNull();
      expect(json.data.account).toBeNull();
    });

    it("lookup after erase-underage on user returns account = null and lockout present", async () => {
      const admin = await db.admin.create({
        data: { email: "admin-erased-lookup@gorola.in", passwordHash: "hash" }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      const minorPhone = "+919876543203";
      const user = await db.user.create({
        data: {
          phone: encryptPII(minorPhone),
          phoneHash: hashPII(minorPhone),
          name: "Minor To Erase",
          isVerified: true,
          isActive: true
        }
      });

      // Erase user
      await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${user.id}/erase-underage`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: "Parent confirmed child was using account" }
      });

      // Lookup original phone
      const lookupRes = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { phone: minorPhone }
      });

      expect(lookupRes.statusCode).toBe(200);
      const json = JSON.parse(lookupRes.body);
      expect(json.data.account).toBeNull();
      expect(json.data.lockout).not.toBeNull();
      expect(json.data.lockout.isActive).toBe(true);
    });

    it("lookup validation and guards: malformed phone -> 400, no auth -> 401, BUYER/STORE_OWNER -> 403", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");
      const buyerToken = await generateAccessToken(randomUUID(), "BUYER");

      const res400 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { phone: "12345" }
      });
      expect(res400.statusCode).toBe(400);

      const res401 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        payload: { phone: testPhone }
      });
      expect(res401.statusCode).toBe(401);

      const res403 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/lookup",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { phone: testPhone }
      });
      expect(res403.statusCode).toBe(403);
    });
  });

  describe("GET /api/v1/admin/age-gate/lockouts", () => {
    it("returns paginated lockout list newest first with summary metrics", async () => {
      const admin = await db.admin.create({
        data: { email: "admin-list@gorola.in", passwordHash: "hash" }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      // Seed 2 active and 1 expired
      const now = Date.now();
      await db.ageGateLockout.createMany({
        data: [
          {
            phoneHash: "hash_active_1",
            lockedUntil: new Date(now + 90 * 24 * 60 * 60 * 1000),
            strikeCount: 1,
            createdAt: new Date(now - 10000)
          },
          {
            phoneHash: "hash_active_2",
            lockedUntil: new Date(now + 60 * 24 * 60 * 60 * 1000),
            strikeCount: 2,
            createdAt: new Date(now - 5000)
          },
          {
            phoneHash: "hash_expired_1",
            lockedUntil: new Date(now - 24 * 60 * 60 * 1000),
            strikeCount: 1,
            createdAt: new Date(now - 8000)
          }
        ]
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/age-gate/lockouts?page=1&limit=20",
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(3);
      expect(json.data.summary.activeCount).toBe(2);
      expect(json.data.summary.createdLast7Days).toBe(3);
      expect(json.data.total).toBe(3);
      expect(json.data.page).toBe(1);
      expect(json.data.limit).toBe(20);

      // Verify item keys
      const item = json.data.items[0];
      expect(Object.keys(item).sort()).toEqual(["createdAt", "id", "isActive", "lockedUntil", "strikeCount"]);

      // Verify pagination limit > 50 rejects with 400
      const resOverLimit = await server.inject({
        method: "GET",
        url: "/api/v1/admin/age-gate/lockouts?page=1&limit=51",
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(resOverLimit.statusCode).toBe(400);
    });
  });

  describe("POST /api/v1/admin/age-gate/decline", () => {
    const testPhone = "+919876543210";
    const validReason = "Call-back could not confirm adult status";

    it("decline appeal records decision without changing lockout date and writes audit log", async () => {
      const admin = await db.admin.create({
        data: { email: "admin-decline@gorola.in", passwordHash: "hash" }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      const phoneHash = hashPII(testPhone);
      const lockedUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const lock = await db.ageGateLockout.create({
        data: {
          phoneHash,
          lockedUntil,
          strikeCount: 1
        }
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/decline",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          phone: testPhone,
          reason: validReason
        }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.data.recorded).toBe(true);

      // Lockout row unchanged
      const remainingLock = await db.ageGateLockout.findUnique({
        where: { id: lock.id }
      });
      expect(remainingLock).not.toBeNull();
      expect(remainingLock?.lockedUntil.toISOString()).toBe(lockedUntil.toISOString());
      expect(remainingLock?.strikeCount).toBe(1);

      // Audit log
      const audit = await db.auditLog.findFirst({
        where: { action: "AGE_GATE_APPEAL_DECLINED" }
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(admin.id);
      expect(audit?.actorRole).toBe("ADMIN");
      expect((audit?.newValue as { reason: string }).reason).toBe(validReason);
      expect(JSON.stringify(audit)).not.toContain("9876543210");
    });

    it("decline validation: reason < 10 chars -> 400, missing lockout -> 404", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");

      const res400 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/decline",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          phone: testPhone,
          reason: "short"
        }
      });
      expect(res400.statusCode).toBe(400);

      const res404 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/decline",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          phone: "+919999999999",
          reason: validReason
        }
      });
      expect(res404.statusCode).toBe(404);
    });
  });

  describe("PUT /api/v1/admin/users/:id/suspend & GET /api/v1/admin/users/:id enhancements", () => {
    it("suspend with reason saves reason in audit log, sets isActive = false, and revokes all user sessions in Redis", async () => {
      const admin = await db.admin.create({
        data: { email: "admin-suspend@gorola.in", passwordHash: "hash" }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      const user = await db.user.create({
        data: {
          phone: encryptPII("+919876543299"),
          phoneHash: hashPII("+919876543299"),
          name: "User To Suspend",
          isVerified: true,
          isActive: true
        }
      });

      // Seed session in redis
      const rt = "test_rt_suspend";
      inMemoryRedisStore.set(`rt:${rt}`, JSON.stringify({ userId: user.id }));
      inMemoryRedisStore.set(
        `user_sessions:${user.id}`,
        JSON.stringify([{ sessionId: "s1", refreshToken: rt }])
      );

      const response = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/users/${user.id}/suspend`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: "Suspicious activity reported on account" }
      });

      expect(response.statusCode).toBe(200);

      // DB check
      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated?.isActive).toBe(false);

      // Redis check: sessions revoked
      expect(inMemoryRedisStore.has(`rt:${rt}`)).toBe(false);
      expect(inMemoryRedisStore.has(`user_sessions:${user.id}`)).toBe(false);

      // Audit check
      const audit = await db.auditLog.findFirst({
        where: { action: "ADMIN_USER_SUSPEND", entityId: user.id }
      });
      expect(audit).not.toBeNull();
      expect((audit?.newValue as { reason?: string })?.reason).toBe(
        "Suspicious activity reported on account"
      );
    });

    it("GET /api/v1/admin/users/:id returns ageConfirmedAt ISO string for confirmed user", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");
      const ageConfirmedAt = new Date("2026-10-05T10:00:00Z");

      const user = await db.user.create({
        data: {
          phone: encryptPII("+919876543298"),
          phoneHash: hashPII("+919876543298"),
          name: "Confirmed User Detail",
          isVerified: true,
          isActive: true,
          ageConfirmedAt,
          ageConfirmedPolicyVersion: "1.1"
        }
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${user.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.data.ageConfirmedAt).toBe(ageConfirmedAt.toISOString());
    });
  });
});
