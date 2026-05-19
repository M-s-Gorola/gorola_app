import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { StoreOwnerRepository } from "../../../modules/store-owner/store-owner.repository.js";
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
}

describe("StoreOwner Dashboard Integration Tests", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const ownerRepo = new StoreOwnerRepository(db);
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
      url: "/api/v1/store/dashboard"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER rather than STORE_OWNER", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/dashboard",
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should return 200 and correct KPI metrics with isolation between stores", async () => {
    // 1. Setup Store A & Store B
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Fast Foods",
      phone: "+919999999902",
      address: "Store B Street"
    });

    // 2. Setup Store Owners
    const ownerA = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeA.id
    });

    const ownerB = await ownerRepo.create({
      email: "owner.b@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeB.id
    });

    // 3. Setup common Buyer User
    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // 4. Setup catalog for Store A
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

    // Low stock variant (stockQty <= lowStockThreshold)
    const variantA1 = await db.productVariant.create({
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

    // Normal stock variant
    const variantA2 = await db.productVariant.create({
      data: {
        productId: productA.id,
        label: "5kg Box",
        price: 700.0,
        stockQty: 20,
        lowStockThreshold: 5,
        isLowStock: false,
        isInStock: true,
        unit: "box",
        isActive: true
      }
    });

    // 5. Seed active ads and offers for Store A
    await db.advertisement.create({
      data: {
        storeId: storeA.id,
        title: "Store A Promo Banner",
        imageUrl: "http://example.com/banner.png",
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        isActive: true,
        isApproved: true
      }
    });

    await db.offer.create({
      data: {
        storeId: storeA.id,
        title: "10% Off Organic Items",
        description: "Save on fresh items",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        isActive: true
      }
    });

    // 6. Create Orders today for Store A
    // Order 1: DELIVERED, placed today (revenue = 150)
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
        items: {
          create: [
            {
              productVariantId: variantA1.id,
              productName: productA.name,
              variantLabel: variantA1.label,
              price: variantA1.price,
              quantity: 1
            }
          ]
        }
      }
    });

    // Order 2: PLACED, placed today (revenue = 700)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "PLACED",
        subtotal: 700.0,
        deliveryFee: 30.0,
        total: 730.0,
        paymentMethod: "UPI",
        landmarkDescription: "Near school",
        items: {
          create: [
            {
              productVariantId: variantA2.id,
              productName: productA.name,
              variantLabel: variantA2.label,
              price: variantA2.price,
              quantity: 1
            }
          ]
        }
      }
    });

    // Order 3: CANCELLED, placed today (excluded from revenue count)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "CANCELLED",
        subtotal: 150.0,
        deliveryFee: 20.0,
        total: 170.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park"
      }
    });

    // 7. Request dashboard for Store Owner A
    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);
    const resA = await server.inject({
      method: "GET",
      url: "/api/v1/store/dashboard",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(resA.statusCode).toBe(200);
    const bodyA = resA.json();
    expect(bodyA.success).toBe(true);
    
    const dataA = bodyA.data;
    // Total order count placed today is 3 (DELIVERED, PLACED, CANCELLED)
    expect(dataA.todayOrderCount).toBe(3);
    // Revenue for DELIVERED (170) + PLACED (730) = 900
    expect(dataA.todayRevenue).toBe(900);
    // Pending orders count (status: PLACED) is 1
    expect(dataA.pendingOrdersCount).toBe(1);

    // Weekly revenue check
    expect(dataA.weeklyRevenue).toBeInstanceOf(Array);
    expect(dataA.weeklyRevenue.length).toBe(7);
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTrend = dataA.weeklyRevenue.find((item: { date: string }) => item.date === todayStr);
    expect(todayTrend).toBeDefined();
    expect(todayTrend.revenue).toBe(900);

    // Top selling products check (Apples sold 2 units across Placed/Delivered)
    expect(dataA.topProducts).toBeInstanceOf(Array);
    expect(dataA.topProducts[0]).toEqual({
      name: "Apples",
      soldCount: 2
    });

    // Low stock alert check
    expect(dataA.lowStockItems).toBeInstanceOf(Array);
    expect(dataA.lowStockItems.length).toBe(1);
    expect(dataA.lowStockItems[0]).toEqual({
      productName: "Apples",
      variantLabel: "1kg",
      stockQty: 2
    });

    expect(dataA.activeAdvertisementsCount).toBe(1);
    expect(dataA.activeOffersCount).toBe(1);

    // 8. Request dashboard for Store Owner B (strict isolation verify)
    const tokenB = await generateAccessToken(ownerB.id, "STORE_OWNER", storeB.id);
    const resB = await server.inject({
      method: "GET",
      url: "/api/v1/store/dashboard",
      headers: {
        authorization: `Bearer ${tokenB}`
      }
    });

    expect(resB.statusCode).toBe(200);
    const dataB = resB.json().data;
    expect(dataB.todayOrderCount).toBe(0);
    expect(dataB.todayRevenue).toBe(0);
    expect(dataB.pendingOrdersCount).toBe(0);
    expect(dataB.activeAdvertisementsCount).toBe(0);
    expect(dataB.activeOffersCount).toBe(0);
    expect(dataB.topProducts.length).toBe(0);
    expect(dataB.lowStockItems.length).toBe(0);
  });
});
