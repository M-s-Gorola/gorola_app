import { randomUUID } from "node:crypto";

import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { RiderEarningsRepository } from "../../../modules/delivery/rider-earnings.repository.js";
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

describe("Rider Earnings Status Trigger Integration Tests", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let keys: ReturnType<typeof resolveBuyerJwtKeyPair>;
  let riderToken: string;
  let riderId: string;
  let storeId: string;
  let overrideStoreId: string;
  let user: { id: string };

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
    vi.restoreAllMocks();

    // Create system settings
    await db.systemSetting.deleteMany({ where: { key: "RIDER_EARNING_RATE_PCT" } });
    await db.systemSetting.create({
      data: { key: "RIDER_EARNING_RATE_PCT", value: "75", updatedBy: "system" }
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

    const overrideStore = await db.store.create({
      data: {
        name: "Override Store",
        description: "Override Store Desc",
        phone: "+919999999902",
        address: "Override Store Address",
        // riderEarningRatePct will be updated later or seeded in DB migration
      }
    });
    overrideStoreId = overrideStore.id;

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

    await db.riderStore.create({
      data: {
        riderId: rider.id,
        storeId: overrideStoreId,
        isPrimary: false
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

    // Create User, Catalog Category & Subcategory to link Orders
    user = await db.user.create({
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
  });

  it("should create a RiderEarning row using global default when status transitions to DELIVERED", async () => {
    const order = await db.order.create({
      data: {
        userId: user.id,
        storeId,
        status: "OUT_FOR_DELIVERY",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 60.00,
        total: 160.00,
        landmarkDescription: "Test Landmark"
      }
    });

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${riderToken}` },
      payload: { status: "DELIVERED" }
    });

    expect(res.statusCode).toBe(200);

    // Verify DB contains RiderEarning row
    const dbWithEarning = db as ReturnType<typeof getPrismaClient> & {
      riderEarning: { findUnique: (args: unknown) => Promise<{ amount: { toNumber: () => number }; riderId: string; earningType: string } | null> };
    };
    const earning = await dbWithEarning.riderEarning.findUnique({
      where: { orderId: order.id }
    });
    expect(earning).toBeDefined();
    expect(earning!.amount.toNumber()).toBe(45.00); // 60 * 75%
    expect(earning!.riderId).toBe(riderId);
    expect(earning!.earningType).toBe("PER_ORDER");
  });

  it("should fail transition if trying to deliver again (idempotency transition check)", async () => {
    const order = await db.order.create({
      data: {
        userId: user.id,
        storeId,
        status: "DELIVERED",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 60.00,
        total: 160.00,
        landmarkDescription: "Test Landmark"
      }
    });

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${riderToken}` },
      payload: { status: "DELIVERED" }
    });

    expect(res.statusCode).toBe(422);
  });

  it("should use store override riderEarningRatePct if defined", async () => {
    // Set store riderEarningRatePct override to 90.00
    await db.store.update({
      where: { id: overrideStoreId },
      data: { riderEarningRatePct: 90.00 }
    });

    const order = await db.order.create({
      data: {
        userId: user.id,
        storeId: overrideStoreId,
        status: "OUT_FOR_DELIVERY",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 60.00,
        total: 160.00,
        landmarkDescription: "Test Landmark"
      }
    });

    const overrideToken = await new SignJWT({ role: "RIDER", storeId: overrideStoreId })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(riderId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(keys.privateKey);

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${overrideToken}` },
      payload: { status: "DELIVERED" }
    });

    expect(res.statusCode).toBe(200);

    const dbWithEarning = db as ReturnType<typeof getPrismaClient> & {
      riderEarning: { findUnique: (args: unknown) => Promise<{ amount: { toNumber: () => number } } | null> };
    };
    const earning = await dbWithEarning.riderEarning.findUnique({
      where: { orderId: order.id }
    });
    expect(earning!.amount.toNumber()).toBe(54.00); // 60 * 90%
  });

  it("should successfully update status to DELIVERED even if RiderEarning creation throws (non-fatal)", async () => {
    // Spy and mock RiderEarningsRepository.prototype.createEarning to throw
    vi.spyOn(RiderEarningsRepository.prototype, "createEarning").mockRejectedValueOnce(new Error("Test DB Write Error"));

    const order = await db.order.create({
      data: {
        userId: user.id,
        storeId,
        status: "OUT_FOR_DELIVERY",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 60.00,
        total: 160.00,
        landmarkDescription: "Test Landmark"
      }
    });

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${riderToken}` },
      payload: { status: "DELIVERED" }
    });

    // Request should still succeed with 200
    expect(res.statusCode).toBe(200);

    // Earning should not have been created in DB (due to mocked failure)
    const dbWithEarning = db as ReturnType<typeof getPrismaClient> & {
      riderEarning: { findUnique: (args: unknown) => Promise<unknown | null> };
    };
    const earning = await dbWithEarning.riderEarning.findUnique({
      where: { orderId: order.id }
    });
    expect(earning).toBeNull();

    // But order status is updated to DELIVERED in DB
    const dbOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(dbOrder?.status).toBe("DELIVERED");
  });
});
