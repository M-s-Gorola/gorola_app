import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  try {
    if ("riderEarning" in db) {
      const dbWithEarning = db as ReturnType<typeof getPrismaClient> & {
        riderEarning: { deleteMany: () => Promise<unknown> };
      };
      await dbWithEarning.riderEarning.deleteMany();
    }
  } catch {
    /* ignore */
  }
  await db.stockMovement.deleteMany();
  await db.riderLocation.deleteMany();
  await db.riderStore.deleteMany();
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
  await db.admin.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
}

describe("Admin Rider Earning Config Integration Tests", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let keys: ReturnType<typeof resolveBuyerJwtKeyPair>;
  let adminToken: string;
  let storeOwnerToken: string;
  let storeId: string;

  beforeAll(async () => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    await server.ready();
    keys = resolveBuyerJwtKeyPair();
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);

    // Create a store
    const store = await db.store.create({
      data: {
        name: "Hillside Store",
        description: "Hillside desc",
        phone: "+919999999901",
        address: "Hillside addr"
      }
    });
    storeId = store.id;

    // Create tokens
    adminToken = await new SignJWT({ role: "ADMIN" })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("admin-123")
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(keys.privateKey);

    storeOwnerToken = await new SignJWT({ role: "STORE_OWNER", storeId })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("owner-123")
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(keys.privateKey);

    // Create store owner profile in DB so /store/settings auth passes
    await db.storeOwner.create({
      data: {
        id: "owner-123",
        email: "owner@gorola.in",
        passwordHash: "dummyhash",
        storeId
      }
    });
  });

  describe("PUT /api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT", () => {
    it("should update setting RIDER_EARNING_RATE_PCT successfully", async () => {
      const res = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { value: "85" }
      });

      expect(res.statusCode).toBe(200);

      const dbSetting = await db.systemSetting.findUnique({
        where: { key: "RIDER_EARNING_RATE_PCT" }
      });
      expect(dbSetting?.value).toBe("85");
    });

    it("should support values above 100", async () => {
      const res = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { value: "150" }
      });

      expect(res.statusCode).toBe(200);

      const dbSetting = await db.systemSetting.findUnique({
        where: { key: "RIDER_EARNING_RATE_PCT" }
      });
      expect(dbSetting?.value).toBe("150");
    });

    it("should reject non-numeric values with 400", async () => {
      const res = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { value: "abc" }
      });

      expect(res.statusCode).toBe(400);
    });

    it("should reject non-admin access with 403", async () => {
      const res = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT",
        headers: { authorization: `Bearer ${storeOwnerToken}` },
        payload: { value: "85" }
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("PUT /api/v1/admin/stores/:storeId/rider-earning-rate", () => {
    it("should update store riderEarningRatePct override successfully", async () => {
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/stores/${storeId}/rider-earning-rate`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { riderEarningRatePct: 100 }
      });

      expect(res.statusCode).toBe(200);

      const dbStore = await db.store.findUnique({ where: { id: storeId } });
      expect(dbStore?.riderEarningRatePct?.toNumber()).toBe(100.00);
    });

    it("should clear store riderEarningRatePct override to null successfully", async () => {
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/stores/${storeId}/rider-earning-rate`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { riderEarningRatePct: null }
      });

      expect(res.statusCode).toBe(200);

      const dbStore = await db.store.findUnique({ where: { id: storeId } });
      expect(dbStore?.riderEarningRatePct).toBeNull();
    });

    it("should reject store override updates with STORE_OWNER JWT with 403", async () => {
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/stores/${storeId}/rider-earning-rate`,
        headers: { authorization: `Bearer ${storeOwnerToken}` },
        payload: { riderEarningRatePct: 90 }
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/v1/store/settings (read-only for store owners)", () => {
    it("should return riderEarningRatePct in store settings response", async () => {
      // Set rate to 95.00
      await db.store.update({
        where: { id: storeId },
        data: { riderEarningRatePct: 95.00 }
      });

      const res = await server.inject({
        method: "GET",
        url: "/api/v1/store/settings",
        headers: { authorization: `Bearer ${storeOwnerToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.riderEarningRatePct).toBe(95.00);
    });
  });
});
