import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function generateAccessToken(userId: string, role: string, storeId?: string): Promise<string> {
  const keys = resolveBuyerJwtKeyPair();
  return new SignJWT({
    role,
    ...(storeId ? { storeId } : {})
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keys.privateKey);
}

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.bookingOrder.deleteMany();
  await db.stockMovement.deleteMany();
  await db.riderLocation.deleteMany();
  await db.deliveryRider.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.store.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
  await db.admin.deleteMany();
  await db.featureFlag.deleteMany();
  await db.auditLog.deleteMany();
}

describe("Admin Feature Flags Integration Tests", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;

  beforeAll(() => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);
  });

  describe("GET /api/v1/admin/feature-flags", () => {
    it("should return 401 Unauthorized when authorization token is missing", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/feature-flags"
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().success).toBe(false);
    });

    it("should return 403 Forbidden when user is a STORE_OWNER", async () => {
      const token = await generateAccessToken("owner-123", "STORE_OWNER", "store-123");
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/feature-flags",
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().success).toBe(false);
    });

    it("should return 200 and list all feature flags for ADMIN", async () => {
      await db.featureFlag.createMany({
        data: [
          { key: "WEATHER_MODE_ACTIVE", value: false, updatedBy: "system", description: "Weather mode active flag" },
          { key: "RIDER_INTERFACE_ENABLED", value: true, updatedBy: "system", description: "Rider interface toggle" }
        ]
      });

      const token = await generateAccessToken("admin-123", "ADMIN");
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/feature-flags",
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(2);
      expect(body.data[0].key).toBe("RIDER_INTERFACE_ENABLED");
      expect(body.data[1].key).toBe("WEATHER_MODE_ACTIVE");
      expect(body.data[0]).toHaveProperty("description");
      expect(body.data[0]).toHaveProperty("updatedAt");
    });
  });

  describe("PUT /api/v1/admin/feature-flags/:key", () => {
    it("should return 401 Unauthorized when token is missing", async () => {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/feature-flags/WEATHER_MODE_ACTIVE",
        payload: { value: true }
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 Forbidden when user is a STORE_OWNER", async () => {
      const token = await generateAccessToken("owner-123", "STORE_OWNER", "store-123");
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/feature-flags/WEATHER_MODE_ACTIVE",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: { value: true }
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 404 Not Found when flag key does not exist", async () => {
      const token = await generateAccessToken("admin-123", "ADMIN");
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/feature-flags/NONEXISTENT_KEY",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: { value: true }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().success).toBe(false);
    });

    it("should return 200, update database value, and create audit log on successful update", async () => {
      await db.featureFlag.create({
        data: {
          key: "WEATHER_MODE_ACTIVE",
          value: false,
          updatedBy: "system",
          description: "Controls weather overlay"
        }
      });

      const token = await generateAccessToken("admin-123", "ADMIN");
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/feature-flags/WEATHER_MODE_ACTIVE",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: { value: true }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.key).toBe("WEATHER_MODE_ACTIVE");
      expect(body.data.value).toBe(true);

      // Verify DB change
      const dbFlag = await db.featureFlag.findUnique({
        where: { key: "WEATHER_MODE_ACTIVE" }
      });
      expect(dbFlag?.value).toBe(true);
      expect(dbFlag?.updatedBy).toBe("admin-123");

      // Verify Audit Log creation
      const auditLog = await db.auditLog.findFirst({
        where: {
          action: "ADMIN_FEATURE_FLAG_UPDATE",
          entityType: "FeatureFlag",
          entityId: "WEATHER_MODE_ACTIVE"
        }
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe("admin-123");
      expect(auditLog?.actorRole).toBe("ADMIN");
      expect(JSON.stringify(auditLog?.oldValue)).toBe(JSON.stringify({ value: false }));
      expect(JSON.stringify(auditLog?.newValue)).toBe(JSON.stringify({ value: true }));
    });
  });
});
