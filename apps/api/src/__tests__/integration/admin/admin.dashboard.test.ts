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
}

describe("Admin Dashboard Integration Tests", () => {
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

  it("should return 401 Unauthorized when authorization token is missing", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER", async () => {
    const token = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a STORE_OWNER", async () => {
    const token = await generateAccessToken("owner-123", "STORE_OWNER", "store-123");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should return 200 and correct aggregate KPI metrics across all stores for ADMIN", async () => {
    // 1. Setup Store A & Store B
    const storeA = await db.store.create({
      data: {
        name: "Store A",
        description: "Organic Groceries",
        phone: "+919999999901",
        address: "Store A Street",
        storeType: "QUICK_COMMERCE"
      }
    });

    const storeB = await db.store.create({
      data: {
        name: "Store B",
        description: "Fast Foods",
        phone: "+919999999902",
        address: "Store B Street",
        storeType: "QUICK_COMMERCE"
      }
    });

    // 2. Setup verified Buyer User
    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // 3. Setup catalog for Store A & B
    const category = await db.category.create({
      data: {
        slug: "groceries",
        name: "Groceries",
        imageUrl: "http://example.com/groceries.png",
        displayOrder: 1,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "fruits",
        name: "Fruits",
        imageUrl: "http://example.com/fruits.png",
        displayOrder: 1,
        isActive: true,
        categoryId: category.id
      }
    });

    const productA = await db.product.create({
      data: {
        name: "Apples",
        description: "Fresh red apples",
        storeId: storeA.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/apples.png",
        isActive: true
      }
    });

    // Low stock variant (isLowStock = true)
    await db.productVariant.create({
      data: {
        productId: productA.id,
        label: "1kg",
        price: 150.0,
        stockQty: 2,
        lowStockThreshold: 5,
        isLowStock: true,
        isInStock: true,
        unit: "kg",
        isActive: true
      }
    });

    const productB = await db.product.create({
      data: {
        name: "Burgers",
        description: "Cheesy burgers",
        storeId: storeB.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/burgers.png",
        isActive: true
      }
    });

    // Normal variant
    await db.productVariant.create({
      data: {
        productId: productB.id,
        label: "Double Cheese",
        price: 250.0,
        stockQty: 10,
        lowStockThreshold: 3,
        isLowStock: false,
        isInStock: true,
        unit: "piece",
        isActive: true
      }
    });

    // 4. Seed active pending ads
    await db.advertisement.create({
      data: {
        storeId: storeA.id,
        title: "Store A Promo Banner",
        imageUrl: "http://example.com/banner.png",
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        isActive: true,
        isApproved: false
      }
    });

    // 5. Seed feature flags
    await db.featureFlag.create({
      data: {
        key: "WEATHER_MODE_ACTIVE",
        value: false,
        updatedBy: "system",
        description: "Controls weather overlay"
      }
    });

    // 6. Create Orders today for both stores
    // Order 1: DELIVERED today for Store A (revenue = 150)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "DELIVERED",
        subtotal: 150.0,
        deliveryFee: 20.0,
        total: 170.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park",
        createdAt: new Date()
      }
    });

    // Order 2: PLACED today for Store B (revenue = 250)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeB.id,
        status: "PLACED",
        subtotal: 250.0,
        deliveryFee: 30.0,
        total: 280.0,
        paymentMethod: "UPI",
        landmarkDescription: "Near school",
        createdAt: new Date()
      }
    });

    // Order 3: CANCELLED today for Store A (excluded from revenue count)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "CANCELLED",
        subtotal: 100.0,
        deliveryFee: 20.0,
        total: 120.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park",
        createdAt: new Date()
      }
    });

    // 7. Request dashboard for ADMIN
    const token = await generateAccessToken("admin-123", "ADMIN");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);

    const data = body.data;
    // Total orders placed today is 3
    expect(data.totalOrdersToday).toBe(3);
    // Total revenue is 170 (Store A) + 280 (Store B) = 450
    expect(data.totalRevenueToday).toBe(450);

    // Platform counts
    expect(data.lowStockAlertCount).toBe(1);
    expect(data.totalActiveBuyers).toBe(1);
    expect(data.totalProducts).toBe(2);
    expect(data.pendingAdApprovalsCount).toBe(1);

    // Per-store breakdown validation
    expect(data.perStoreBreakdown).toBeInstanceOf(Array);
    expect(data.perStoreBreakdown.length).toBe(2);

    const storeABreakdown = data.perStoreBreakdown.find((s: { storeId: string }) => s.storeId === storeA.id);
    const storeBBreakdown = data.perStoreBreakdown.find((s: { storeId: string }) => s.storeId === storeB.id);

    expect(storeABreakdown).toBeDefined();
    // Store A orders placed today: 2 (DELIVERED, CANCELLED)
    expect(storeABreakdown.ordersToday).toBe(2);
    // Store A revenue: 170
    expect(storeABreakdown.revenueToday).toBe(170);
    // Store A pending orders count (status PLACED): 0
    expect(storeABreakdown.pendingOrdersCount).toBe(0);

    expect(storeBBreakdown).toBeDefined();
    // Store B orders placed today: 1 (PLACED)
    expect(storeBBreakdown.ordersToday).toBe(1);
    // Store B revenue: 280
    expect(storeBBreakdown.revenueToday).toBe(280);
    // Store B pending orders count: 1
    expect(storeBBreakdown.pendingOrdersCount).toBe(1);

    // Feature flags check
    expect(data.featureFlags).toBeInstanceOf(Array);
    const weatherFlag = data.featureFlags.find((f: { key: string }) => f.key === "WEATHER_MODE_ACTIVE");
    expect(weatherFlag).toBeDefined();
    expect(weatherFlag.value).toBe(false);

    // Weekly revenue check
    expect(data.weeklyRevenue).toBeInstanceOf(Array);
    expect(data.weeklyRevenue.length).toBe(7);
  });
});
