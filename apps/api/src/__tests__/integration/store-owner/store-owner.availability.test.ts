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
}

describe("StoreOwner Availability Integration Tests", () => {
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

  it("should return 401/403 when updating availability without token or correct role", async () => {
    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/store/availability",
      payload: { isAcceptingOrders: false }
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it("should toggle store availability and filter products for buyer", async () => {
    // Setup
    const category = await db.category.create({
      data: { slug: "groceries", name: "Groceries" }
    });
    const subCategory = await db.subCategory.create({
      data: { slug: "fruits", name: "Fruits", categoryId: category.id }
    });

    const store1 = await db.store.create({
      data: {
        name: "Fruit Mart",
        description: "Fresh fruits",
        phone: "+911234567890",
        address: "Dehradun",
        isAcceptingOrders: true
      }
    });

    const owner = await db.storeOwner.create({
      data: {
        email: "owner1@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store1.id
      }
    });

    const product = await db.product.create({
      data: {
        storeId: store1.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Apple",
        description: "Fresh red apples",
        imageUrl: "http://example.com/apple.jpg",
        isActive: true
      }
    });

    await db.productVariant.create({
      data: {
        productId: product.id,
        label: "1kg",
        price: 150.00,
        unit: "kg",
        stockQty: 50,
        isActive: true,
        isAvailableForBooking: true
      }
    });

    const ownerToken = await generateAccessToken(owner.id, "STORE_OWNER", store1.id);

    // 1. Initially, buyer sees the product
    const initialBuyerRes = await server.inject({
      method: "GET",
      url: `/api/v1/products?categoryId=${category.id}`
    });
    expect(initialBuyerRes.statusCode).toBe(200);
    expect(initialBuyerRes.json().data.items.length).toBeGreaterThan(0);

    // 2. Toggle Store accepts orders to false
    const toggleOffRes = await server.inject({
      method: "PUT",
      url: "/api/v1/store/availability",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isAcceptingOrders: false }
    });
    expect(toggleOffRes.statusCode).toBe(200);
    expect(toggleOffRes.json().success).toBe(true);

    const checkStoreInDb = await db.store.findUnique({ where: { id: store1.id } });
    expect(checkStoreInDb?.isAcceptingOrders).toBe(false);

    // 3. Buyer queries products -> should return 0 products because store is closed
    const buyerResAfterClosed = await server.inject({
      method: "GET",
      url: `/api/v1/products?categoryId=${category.id}`
    });
    expect(buyerResAfterClosed.statusCode).toBe(200);
    expect(buyerResAfterClosed.json().data.items.length).toBe(0);

    // 4. Toggle back to true
    const toggleOnRes = await server.inject({
      method: "PUT",
      url: "/api/v1/store/availability",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isAcceptingOrders: true }
    });
    expect(toggleOnRes.statusCode).toBe(200);

    // Buyer sees product again
    const buyerResAfterReopened = await server.inject({
      method: "GET",
      url: `/api/v1/products?categoryId=${category.id}`
    });
    expect(buyerResAfterReopened.json().data.items.length).toBeGreaterThan(0);
  });

  it("should toggle variant availability and filter variants for buyer detail", async () => {
    // Setup
    const category = await db.category.create({
      data: { slug: "services", name: "Services" }
    });
    const subCategory = await db.subCategory.create({
      data: { slug: "tests", name: "Tests", categoryId: category.id }
    });

    const store1 = await db.store.create({
      data: {
        name: "Max Lab",
        description: "Diagnostics",
        phone: "+911234567891",
        address: "Dehradun",
        isAcceptingOrders: true
      }
    });

    const owner = await db.storeOwner.create({
      data: {
        email: "owner2@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store1.id
      }
    });

    const product = await db.product.create({
      data: {
        storeId: store1.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Blood Test",
        description: "CBC",
        imageUrl: "http://example.com/blood.jpg",
        isActive: true
      }
    });

    const variant1 = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Home Sample Collection",
        price: 500.00,
        unit: "test",
        stockQty: 999,
        isActive: true,
        isAvailableForBooking: true
      }
    });

    const variant2 = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Lab Walk-in",
        price: 400.00,
        unit: "test",
        stockQty: 999,
        isActive: true,
        isAvailableForBooking: true
      }
    });

    const ownerToken = await generateAccessToken(owner.id, "STORE_OWNER", store1.id);

    // 1. Initial product detail has 2 variants
    const initialDetailRes = await server.inject({
      method: "GET",
      url: `/api/v1/products/${product.id}`
    });
    expect(initialDetailRes.statusCode).toBe(200);
    expect(initialDetailRes.json().data.variants.length).toBe(2);

    // 2. Toggle variant1 availability to false
    const toggleVariantRes = await server.inject({
      method: "PUT",
      url: `/api/v1/store/products/${product.id}/variants/${variant1.id}/availability`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isAvailableForBooking: false }
    });
    expect(toggleVariantRes.statusCode).toBe(200);
    expect(toggleVariantRes.json().success).toBe(true);

    const checkVariantInDb = await db.productVariant.findUnique({ where: { id: variant1.id } });
    expect(checkVariantInDb?.isAvailableForBooking).toBe(false);

    // 3. Buyer queries product detail → STILL sees BOTH variants because
    //    isAvailableForBooking controls booking-slot eligibility, NOT catalog
    //    visibility. The fix removed this flag from the buyer variant filter so
    //    QUICK_COMMERCE products stay visible regardless of booking availability.
    const buyerDetailRes = await server.inject({
      method: "GET",
      url: `/api/v1/products/${product.id}`
    });
    expect(buyerDetailRes.json().data.variants.length).toBe(2);
    expect(buyerDetailRes.json().data.variants.some((v: { id: string }) => v.id === variant1.id)).toBe(true);
    expect(buyerDetailRes.json().data.variants.some((v: { id: string }) => v.id === variant2.id)).toBe(true);
  });

  it("should enforce tenant isolation (403 when modifying other store's variants)", async () => {
    // Setup
    const category = await db.category.create({
      data: { slug: "isolated", name: "Isolated" }
    });
    const subCategory = await db.subCategory.create({
      data: { slug: "sub-isolated", name: "SubIsolated", categoryId: category.id }
    });

    const storeA = await db.store.create({ data: { name: "Store A", description: "A", phone: "123", address: "A" } });
    const storeB = await db.store.create({ data: { name: "Store B", description: "B", phone: "456", address: "B" } });

    const ownerA = await db.storeOwner.create({
      data: { email: "ownerA@gorola.in", passwordHash: "dummy-hash", storeId: storeA.id }
    });

    const productB = await db.product.create({
      data: { storeId: storeB.id, categoryId: category.id, subCategoryId: subCategory.id, name: "Item B", description: "B", imageUrl: "B", isActive: true }
    });

    const variantB = await db.productVariant.create({
      data: { productId: productB.id, label: "Var B", price: 100, unit: "pc", stockQty: 10, isActive: true, isAvailableForBooking: true }
    });

    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);

    // Owner A tries to modify variant of Product B (which belongs to Store B)
    const hijackRes = await server.inject({
      method: "PUT",
      url: `/api/v1/store/products/${productB.id}/variants/${variantB.id}/availability`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { isAvailableForBooking: false }
    });

    expect(hijackRes.statusCode).toBe(403);
  });
});
