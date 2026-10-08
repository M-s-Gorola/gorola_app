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
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.admin.deleteMany();
}

describe("Admin Age Gate Integration Tests (8.8.8)", () => {
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

  describe("POST /api/v1/admin/age-gate/unlock", () => {
    const testPhone = "+919876543210";
    const validReason = "Verified by call-back, adult confirmed";

    it("should unlock a locked phone, delete the lockout row, and create an audit log with no phone digits", async () => {
      const admin = await db.admin.create({
        data: {
          email: "admin-unlock@gorola.in",
          passwordHash: "irrelevant_hash"
        }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      // Seed an active lockout
      const phoneHash = hashPII(testPhone);
      await ageGateRepo.upsertLock(phoneHash, new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/unlock",
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          phone: testPhone,
          reason: validReason
        }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.cleared).toBe(true);

      // Verify DB: lockout is gone
      const remainingLock = await db.ageGateLockout.findUnique({
        where: { phoneHash }
      });
      expect(remainingLock).toBeNull();

      // Verify DB: audit log created
      const auditLogs = await db.auditLog.findMany({
        where: { action: "AGE_GATE_LOCKOUT_CLEARED" }
      });
      expect(auditLogs).toHaveLength(1);
      const log = auditLogs[0]!;
      expect(log.actorId).toBe(admin.id);
      expect(log.actorRole).toBe("ADMIN");
      expect(log.entityType).toBe("AgeGateLockout");
      expect((log.newValue as { reason: string }).reason).toBe(validReason);

      // STRICT: No phone digits anywhere in audit log
      const logStr = JSON.stringify(log);
      expect(logStr).not.toContain("9876543210");
      expect(logStr).not.toContain(testPhone);
    });

    it("should reject unauthenticated request with 401", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/unlock",
        payload: {
          phone: testPhone,
          reason: validReason
        }
      });
      expect(response.statusCode).toBe(401);
    });

    it("should reject BUYER and STORE_OWNER roles with 403", async () => {
      const buyerToken = await generateAccessToken(randomUUID(), "BUYER");
      const storeOwnerToken = await generateAccessToken(randomUUID(), "STORE_OWNER");

      const resBuyer = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/unlock",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { phone: testPhone, reason: validReason }
      });
      expect(resBuyer.statusCode).toBe(403);

      const resStore = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/unlock",
        headers: { authorization: `Bearer ${storeOwnerToken}` },
        payload: { phone: testPhone, reason: validReason }
      });
      expect(resStore.statusCode).toBe(403);
    });

    it("should reject reason shorter than 10 characters with 400", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/unlock",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          phone: testPhone,
          reason: "Too short"
        }
      });
      expect(response.statusCode).toBe(400);
    });

    it("should reject malformed phone with 400", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/unlock",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          phone: "12345",
          reason: validReason
        }
      });
      expect(response.statusCode).toBe(400);
    });

    it("should return 404 when phone has no active lockout", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/age-gate/unlock",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          phone: "+919999999999",
          reason: validReason
        }
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/admin/users/:id/erase-underage", () => {
    const validReason = "Parent report confirmed account holder is minor";
    const minorPhone = "+919123456789";

    it("should erase user, revoke sessions, lock pre-purge phone hash, and create audit log", async () => {
      const admin = await db.admin.create({
        data: {
          email: "admin-erase@gorola.in",
          passwordHash: "irrelevant_hash"
        }
      });
      const adminToken = await generateAccessToken(admin.id, "ADMIN");

      // Seed a buyer user with address and sessions
      const buyer = await db.user.create({
        data: {
          phone: encryptPII(minorPhone),
          phoneHash: hashPII(minorPhone),
          name: "Discovered Minor",
          isVerified: true
        }
      });

      await db.address.create({
        data: {
          userId: buyer.id,
          flatRoom: "101",
          landmarkDescription: "Near Park",
          label: "HOME"
        }
      });

      // Seed redis session tokens
      const rtToken = "sample_refresh_token_abc";
      inMemoryRedisStore.set(`rt:${rtToken}`, JSON.stringify({ userId: buyer.id }));
      inMemoryRedisStore.set(
        `user_sessions:${buyer.id}`,
        JSON.stringify([{ sessionId: "sess_1", refreshToken: rtToken }])
      );

      const response = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${buyer.id}/erase-underage`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          reason: validReason
        }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.erased).toBe(true);

      // Verify DB: User is anonymized / soft-deleted
      const purgedUser = await db.user.findUnique({
        where: { id: buyer.id }
      });
      expect(purgedUser).not.toBeNull();
      expect(purgedUser!.name).toBe("[deleted]");
      expect(purgedUser!.phone).toBe(`DELETED_${buyer.id}`);
      expect(purgedUser!.phoneHash).toBeNull();
      expect(purgedUser!.isActive).toBe(false);
      expect(purgedUser!.isDeleted).toBe(true);

      // Addresses are deleted
      const addresses = await db.address.findMany({
        where: { userId: buyer.id }
      });
      expect(addresses).toHaveLength(0);

      // Redis sessions revoked
      expect(inMemoryRedisStore.has(`rt:${rtToken}`)).toBe(false);
      expect(inMemoryRedisStore.has(`user_sessions:${buyer.id}`)).toBe(false);

      // AgeGateLockout row exists for the PRE-PURGE phone hash
      const prePurgeHash = hashPII(minorPhone);
      const lockout = await db.ageGateLockout.findUnique({
        where: { phoneHash: prePurgeHash }
      });
      expect(lockout).not.toBeNull();
      expect(lockout!.strikeCount).toBe(1);
      expect(lockout!.lockedUntil.getTime()).toBeGreaterThan(Date.now() + 80 * 24 * 60 * 60 * 1000);

      // AuditLog created
      const auditLogs = await db.auditLog.findMany({
        where: { action: "USER_ERASED_UNDERAGE" }
      });
      expect(auditLogs).toHaveLength(1);
      const log = auditLogs[0]!;
      expect(log.actorId).toBe(admin.id);
      expect(log.actorRole).toBe("ADMIN");
      expect(log.entityType).toBe("User");
      expect(log.entityId).toBe(buyer.id);
      expect((log.newValue as { reason: string }).reason).toBe(validReason);

      // STRICT: No raw phone digits in audit log
      const logStr = JSON.stringify(log);
      expect(logStr).not.toContain("9123456789");
    });

    it("should return 404 for non-existent user", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");
      const response = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${randomUUID()}/erase-underage`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: validReason }
      });
      expect(response.statusCode).toBe(404);
    });

    it("should return 409 ALREADY_ERASED if user was already erased", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");

      const alreadyErased = await db.user.create({
        data: {
          phone: `DELETED_${randomUUID()}`,
          phoneHash: null,
          name: "[deleted]",
          isDeleted: true,
          isActive: false
        }
      });

      const response = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${alreadyErased.id}/erase-underage`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: validReason }
      });

      expect(response.statusCode).toBe(409);
      const json = JSON.parse(response.body);
      expect(json.error.code).toBe("ALREADY_ERASED");
    });

    it("should reject non-admin tokens with 401/403", async () => {
      const buyerToken = await generateAccessToken(randomUUID(), "BUYER");
      const responseNoAuth = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${randomUUID()}/erase-underage`,
        payload: { reason: validReason }
      });
      expect(responseNoAuth.statusCode).toBe(401);

      const responseBuyer = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${randomUUID()}/erase-underage`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { reason: validReason }
      });
      expect(responseBuyer.statusCode).toBe(403);
    });

    it("should reject reason shorter than 10 characters with 400", async () => {
      const adminToken = await generateAccessToken(randomUUID(), "ADMIN");
      const response = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${randomUUID()}/erase-underage`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: "short" }
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
