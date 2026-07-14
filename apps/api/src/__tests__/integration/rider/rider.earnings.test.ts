import { randomUUID } from "node:crypto";

import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  // Try to delete RiderEarning if model exists
  try {
    if ("riderEarning" in db) {
      const dbWithEarning = db as ReturnType<typeof getPrismaClient> & {
        riderEarning: { deleteMany: () => Promise<unknown> };
      };
      await dbWithEarning.riderEarning.deleteMany();
    }
  } catch {
    // Ignore if model doesn't exist yet
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

describe("Rider Earnings Integration Tests", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let keys: ReturnType<typeof resolveBuyerJwtKeyPair>;
  let riderToken: string;
  let otherRiderToken: string;
  let buyerToken: string;
  let riderId: string;
  let otherRiderId: string;
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

    // Create system settings
    await db.systemSetting.deleteMany({ where: { key: "RIDER_EARNING_RATE_PCT" } });
    await db.systemSetting.create({
      data: { key: "RIDER_EARNING_RATE_PCT", value: "80", updatedBy: "system" }
    });

    // Create stores
    const store = await db.store.create({
      data: {
        name: "Test Store",
        description: "Test Store Desc",
        phone: "+919999999901",
        address: "Test Store Address"
      }
    });
    storeId = store.id;

    await db.store.create({
      data: {
        name: "Override Store",
        description: "Override Store Desc",
        phone: "+919999999902",
        address: "Override Store Address",
        // riderEarningRatePct will be updated later or seeded in DB migration
      }
    });

    // Create riders
    const passwordHash = await hash("Rider#123", 8);
    const rider = await db.deliveryRider.create({
      data: {
        name: "Test Rider",
        phone: "+919000000011",
        email: "rider1@gorola.in",
        passwordHash,
        isActive: true
      }
    });
    riderId = rider.id;

    await db.riderStore.create({
      data: {
        riderId: rider.id,
        storeId: storeId,
        isPrimary: true
      }
    });

    const otherRider = await db.deliveryRider.create({
      data: {
        name: "Other Rider",
        phone: "+919000000012",
        email: "rider2@gorola.in",
        passwordHash,
        isActive: true
      }
    });
    otherRiderId = otherRider.id;

    await db.riderStore.create({
      data: {
        riderId: otherRider.id,
        storeId: storeId,
        isPrimary: true
      }
    });

    // Create tokens
    riderToken = await new SignJWT({ role: "RIDER", storeId })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(riderId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(keys.privateKey);

    otherRiderToken = await new SignJWT({ role: "RIDER", storeId })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(otherRiderId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(keys.privateKey);

    buyerToken = await new SignJWT({ role: "BUYER" })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("buyer-123")
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(keys.privateKey);

    // Create User, Catalog Category & Subcategory to link Orders
    const user = await db.user.create({
      data: { name: "Test Buyer", phone: "+919876543211", isVerified: true }
    });

    const category = await db.category.create({
      data: { slug: "groceries", name: "Groceries", isActive: true }
    });

    const subCategory = await db.subCategory.create({
      data: { slug: "veg", name: "Veg", categoryId: category.id }
    });

    const product = await db.product.create({
      data: {
        storeId,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Apple",
        description: "Fresh apples",
        imageUrl: "apple.png"
      }
    });

    await db.productVariant.create({
      data: {
        productId: product.id,
        label: "1kg",
        price: 100,
        stockQty: 50,
        unit: "kg"
      }
    });

    // Create 3 orders
    const ordersData = [];
    for (let i = 0; i < 3; i++) {
      const order = await db.order.create({
        data: {
          userId: user.id,
          storeId,
          status: "DELIVERED",
          orderType: "QUICK",
          subtotal: 100,
          deliveryFee: 50,
          total: 150,
          landmarkDescription: "Test Landmark",
          deliveryLat: 30.4598,
          deliveryLng: 78.0664
        }
      });
      ordersData.push(order);
    }

    // Seed earnings for rider (3 earnings of 40 each)
    if ("riderEarning" in db) {
      const dbWithEarning = db as ReturnType<typeof getPrismaClient> & {
        riderEarning: { create: (args: unknown) => Promise<unknown> };
      };
      for (const order of ordersData) {
        await dbWithEarning.riderEarning.create({
          data: {
            riderId,
            orderId: order.id,
            amount: 40.0,
            earningType: "PER_ORDER",
            distanceKm: null
          }
        });
      }
    }
  });

  describe("GET /api/v1/rider/earnings/summary", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/rider/earnings/summary"
      });
      expect(res.statusCode).toBe(401);
    });

    it("should return 403 when user is not a RIDER", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/rider/earnings/summary",
        headers: { authorization: `Bearer ${buyerToken}` }
      });
      expect(res.statusCode).toBe(403);
    });

    it("should return 200 and return the correct summary for today, thisWeek, and thisMonth", async () => {
      // Note: We bypass typing issues by dynamically executing tests when endpoints exist
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/rider/earnings/summary",
        headers: { authorization: `Bearer ${riderToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.today).toEqual({ count: 3, total: "120.00" });
      expect(body.data.thisWeek).toEqual({ count: 3, total: "120.00" });
      expect(body.data.thisMonth).toEqual({ count: 3, total: "120.00" });
    });

    it("should return 200 with zero totals for a rider with no earnings", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/rider/earnings/summary",
        headers: { authorization: `Bearer ${otherRiderToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.today).toEqual({ count: 0, total: "0.00" });
      expect(body.data.thisWeek).toEqual({ count: 0, total: "0.00" });
      expect(body.data.thisMonth).toEqual({ count: 0, total: "0.00" });
    });
  });

  describe("GET /api/v1/rider/earnings/history", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/rider/earnings/history"
      });
      expect(res.statusCode).toBe(401);
    });

    it("should return 200 and list earnings newest-first", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/rider/earnings/history",
        headers: { authorization: `Bearer ${riderToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(3);
      expect(body.data.items[0].amount).toBe("40.00");
      expect(body.data.items[0].earningType).toBe("PER_ORDER");
      expect(body.data.items[0].distanceKm).toBeNull();
      expect(body.data.nextCursor).toBeNull();
    });

    it("should support cursor pagination", async () => {
      const res1 = await server.inject({
        method: "GET",
        url: "/api/v1/rider/earnings/history?limit=2",
        headers: { authorization: `Bearer ${riderToken}` }
      });
      expect(res1.statusCode).toBe(200);
      const body1 = res1.json();
      expect(body1.data.items).toHaveLength(2);
      expect(body1.data.nextCursor).not.toBeNull();

      const res2 = await server.inject({
        method: "GET",
        url: `/api/v1/rider/earnings/history?limit=2&cursor=${body1.data.nextCursor}`,
        headers: { authorization: `Bearer ${riderToken}` }
      });
      expect(res2.statusCode).toBe(200);
      const body2 = res2.json();
      expect(body2.data.items).toHaveLength(1);
      expect(body2.data.nextCursor).toBeNull();
    });

    it("should return empty list for rider with no earnings", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/rider/earnings/history",
        headers: { authorization: `Bearer ${otherRiderToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(0);
    });
  });
});
