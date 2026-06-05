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
  const claims: Record<string, unknown> = { role };
  if (storeId) {
    claims.storeId = storeId;
  }
  return new SignJWT(claims)
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

describe("Buyer & Store Owner Audit Logs Integration Tests", () => {
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

  it("should log BUYER_ORDER_CREATE when buyer checkouts quick commerce order", async () => {
    // 1. Seed store, category, subcategory, product, variant
    const store = await db.store.create({
      data: {
        name: "Test Store",
        description: "Test Desc",
        phone: "+911112223330",
        address: "Address",
        storeType: "QUICK_COMMERCE",
        isActive: true
      }
    });

    const category = await db.category.create({
      data: { name: "Food", slug: "food" }
    });

    const subCategory = await db.subCategory.create({
      data: { name: "Groceries", slug: "groceries", categoryId: category.id }
    });

    const product = await db.product.create({
      data: {
        name: "Apple",
        description: "Red Apple",
        imageUrl: "http://example.com/apple.jpg",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        isActive: true
      }
    });

    const variant = await db.productVariant.create({
      data: {
        label: "1kg",
        price: 100,
        unit: "kg",
        stockQty: 50,
        productId: product.id,
        isActive: true
      }
    });

    // 2. Seed buyer, address, cart, cartItem
    const buyer = await db.user.create({
      data: {
        name: "John Doe",
        phone: "+919876543210",
        isVerified: true
      }
    });

    const address = await db.address.create({
      data: {
        label: "Home",
        flatRoom: "Flat 101",
        landmarkDescription: "Near Park",
        userId: buyer.id
      }
    });

    const cart = await db.cart.create({
      data: { userId: buyer.id }
    });

    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productVariantId: variant.id,
        quantity: 2
      }
    });

    const buyerToken = await generateAccessToken(buyer.id, "BUYER");

    // 3. Inject checkout request
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: {
        authorization: `Bearer ${buyerToken}`,
        "user-agent": "TestAgent"
      },
      payload: {
        addressMode: "saved",
        addressId: address.id,
        paymentMethod: "COD"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const orderId = body.data.id;

    // 4. Assert audit log is written
    const log = await db.auditLog.findFirst({
      where: {
        actorRole: "BUYER",
        action: "BUYER_ORDER_CREATE",
        entityId: orderId
      }
    });

    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(buyer.id);
    expect(log?.entityType).toBe("Order");
    expect(log?.userAgent).toBe("TestAgent");
  });

  it("should log STORE_ORDER_STATUS_UPDATE when merchant updates order status", async () => {
    // 1. Seed store, merchant, buyer, order
    const store = await db.store.create({
      data: {
        name: "Test Store",
        description: "Test Desc",
        phone: "+911112223330",
        address: "Address",
        storeType: "QUICK_COMMERCE",
        isActive: true
      }
    });

    const storeOwner = await db.storeOwner.create({
      data: {
        email: "owner@test.com",
        passwordHash: "dummy",
        storeId: store.id
      }
    });

    const buyer = await db.user.create({
      data: {
        name: "John Doe",
        phone: "+919876543210",
        isVerified: true
      }
    });

    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: store.id,
        status: "PLACED",
        subtotal: 100,
        deliveryFee: 30,
        total: 130,
        paymentMethod: "COD",
        landmarkDescription: "Park"
      }
    });

    const merchantToken = await generateAccessToken(storeOwner.id, "STORE_OWNER", store.id);

    // 2. Inject order status update request
    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/store/orders/${order.id}/status`,
      headers: {
        authorization: `Bearer ${merchantToken}`,
        "user-agent": "MerchantAgent"
      },
      payload: {
        status: "PREPARING"
      }
    });

    expect(response.statusCode).toBe(200);

    // 3. Assert audit log is written
    const log = await db.auditLog.findFirst({
      where: {
        actorRole: "STORE_OWNER",
        action: "STORE_ORDER_STATUS_UPDATE",
        entityId: order.id
      }
    });

    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(storeOwner.id);
    expect(log?.entityType).toBe("Order");
    expect(log?.userAgent).toBe("MerchantAgent");
    expect(JSON.stringify(log?.oldValue)).toBe(JSON.stringify({ status: "PLACED" }));
    expect(JSON.stringify(log?.newValue)).toBe(JSON.stringify({ status: "PREPARING" }));
  });

  it("should log BUYER_BOOKING_CREATE, STORE_BOOKING_APPROVE, and STORE_PRODUCT_CREATE", async () => {
    // 1. Seed booking store, category, subcategory, product, variant
    const store = await db.store.create({
      data: {
        name: "Booking Store",
        description: "Booking Desc",
        phone: "+911112223330",
        address: "Address",
        storeType: "BOOKING_COMMERCE",
        isActive: true,
        isAcceptingBookings: true,
        bookingLeadDays: 1
      }
    });

    const storeOwner = await db.storeOwner.create({
      data: {
        email: "owner2@test.com",
        passwordHash: "dummy",
        storeId: store.id
      }
    });

    const category = await db.category.create({
      data: { name: "Health", slug: "health" }
    });

    const subCategory = await db.subCategory.create({
      data: { name: "Tests", slug: "tests", categoryId: category.id }
    });

    const product = await db.product.create({
      data: {
        name: "Blood Test",
        description: "Blood Test Desc",
        imageUrl: "http://example.com/blood.jpg",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        isActive: true
      }
    });

    const variant = await db.productVariant.create({
      data: {
        label: "Standard",
        price: 500,
        unit: "test",
        stockQty: 9999, // Booking doesn't enforce, but set large
        productId: product.id,
        isActive: true,
        allowedTimeslots: ["08:00 - 09:00", "09:00 - 10:00"]
      }
    });

    const buyer = await db.user.create({
      data: {
        name: "Jane Doe",
        phone: "+919876543211",
        isVerified: true
      }
    });

    const address = await db.address.create({
      data: {
        label: "Home",
        flatRoom: "Flat 102",
        landmarkDescription: "Near Park 2",
        userId: buyer.id
      }
    });

    const buyerToken = await generateAccessToken(buyer.id, "BUYER");
    const merchantToken = await generateAccessToken(storeOwner.id, "STORE_OWNER", store.id);

    // --- TEST 1: Buyer booking request ---
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(12, 0, 0, 0);

    const resBooking = await server.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: {
        authorization: `Bearer ${buyerToken}`,
        "user-agent": "BookingAgent"
      },
      payload: {
        storeId: store.id,
        items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "08:00 - 09:00",
        addressId: address.id
      }
    });

    expect(resBooking.statusCode).toBe(201);
    const bookingId = resBooking.json().data.orderId;

    const logBooking = await db.auditLog.findFirst({
      where: {
        actorRole: "BUYER",
        action: "BUYER_BOOKING_CREATE",
        entityId: bookingId
      }
    });
    expect(logBooking).not.toBeNull();
    expect(logBooking?.userAgent).toBe("BookingAgent");

    // --- TEST 2: Store Owner approve booking ---
    const resApprove = await server.inject({
      method: "PUT",
      url: `/api/v1/store/bookings/${bookingId}/approve`,
      headers: {
        authorization: `Bearer ${merchantToken}`,
        "user-agent": "ApproveAgent"
      }
    });
    expect(resApprove.statusCode).toBe(200);

    const logApprove = await db.auditLog.findFirst({
      where: {
        actorRole: "STORE_OWNER",
        action: "STORE_BOOKING_APPROVE",
        entityId: bookingId
      }
    });
    expect(logApprove).not.toBeNull();
    expect(logApprove?.userAgent).toBe("ApproveAgent");

    // --- TEST 3: Store Owner product creation ---
    const resProduct = await server.inject({
      method: "POST",
      url: "/api/v1/store/products",
      headers: {
        authorization: `Bearer ${merchantToken}`,
        "user-agent": "ProductCreateAgent"
      },
      payload: {
        name: "New Test Product",
        subCategoryId: subCategory.id,
        description: "New Description",
        imageUrl: "http://example.com/new.jpg",
        variants: [
          {
            label: "Small",
            price: 50,
            stockQty: 100,
            unit: "piece"
          }
        ]
      }
    });

    expect(resProduct.statusCode).toBe(201);
    const newProductId = resProduct.json().data.id;

    const logProduct = await db.auditLog.findFirst({
      where: {
        actorRole: "STORE_OWNER",
        action: "STORE_PRODUCT_CREATE",
        entityId: newProductId
      }
    });
    expect(logProduct).not.toBeNull();
    expect(logProduct?.userAgent).toBe("ProductCreateAgent");
  });
});
