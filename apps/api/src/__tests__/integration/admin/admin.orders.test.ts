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

describe("Admin Orders Integration Tests", () => {
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

  it("should fail validation/auth checks when no token is provided", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/orders"
    });
    expect(response.statusCode).toBe(401);
  });

  it("should fail when user is not an ADMIN", async () => {
    const token = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/orders",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(response.statusCode).toBe(403);
  });

  it("should list all orders across all stores, filter by store and status, and verify output envelope", async () => {
    // 1. Create store A & B
    const storeA = await db.store.create({
      data: {
        name: "Store Alpha",
        description: "Alpha partner",
        phone: "+919999999001",
        address: "Alpha street",
        storeType: "QUICK_COMMERCE"
      }
    });

    const storeB = await db.store.create({
      data: {
        name: "Store Beta",
        description: "Beta partner",
        phone: "+919999999002",
        address: "Beta street",
        storeType: "QUICK_COMMERCE"
      }
    });

    // 2. Create user
    const buyer = await db.user.create({
      data: {
        name: "Buyer One",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // 3. Create products & variants for stock checks
    const category = await db.category.create({
      data: {
        slug: "food",
        name: "Food",
        imageUrl: "http://example.com/food.png",
        displayOrder: 1,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "snacks",
        name: "Snacks",
        imageUrl: "http://example.com/snacks.png",
        displayOrder: 1,
        isActive: true,
        categoryId: category.id
      }
    });

    const productA = await db.product.create({
      data: {
        name: "Chips",
        description: "Potato chips",
        storeId: storeA.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/chips.png",
        isActive: true
      }
    });

    const variantA = await db.productVariant.create({
      data: {
        productId: productA.id,
        label: "Regular",
        price: 20.0,
        stockQty: 50,
        lowStockThreshold: 5,
        unit: "pack",
        isActive: true
      }
    });

    // 4. Create orders
    const order1 = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "PLACED",
        subtotal: 40.0,
        deliveryFee: 10.0,
        total: 50.0,
        paymentMethod: "COD",
        landmarkDescription: "Gate 1",
        items: {
          create: {
            productVariantId: variantA.id,
            productName: "Chips",
            variantLabel: "Regular",
            price: 20.0,
            quantity: 2
          }
        }
      }
    });

    const order2 = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeB.id,
        status: "DELIVERED",
        subtotal: 60.0,
        deliveryFee: 15.0,
        total: 75.0,
        paymentMethod: "UPI",
        landmarkDescription: "Gate 2",
        items: {
          create: {
            productVariantId: variantA.id,
            productName: "Chips",
            variantLabel: "Regular",
            price: 20.0,
            quantity: 3
          }
        }
      }
    });

    const token = await generateAccessToken("admin-123", "ADMIN");

    // Test: GET all orders
    const resAll = await server.inject({
      method: "GET",
      url: "/api/v1/admin/orders",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(resAll.statusCode).toBe(200);
    const bodyAll = resAll.json();
    expect(bodyAll.success).toBe(true);
    expect(bodyAll.data.items.length).toBe(2);

    const first = bodyAll.data.items[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("buyerMaskedPhone");
    expect(first).toHaveProperty("storeName");
    expect(first).toHaveProperty("itemsCount");
    expect(first).toHaveProperty("total");
    expect(first).toHaveProperty("status");
    expect(first).toHaveProperty("createdAt");
    expect(first).toHaveProperty("paymentMethod");
    expect(first.buyerMaskedPhone).toBe("*********3210");

    // Test: GET order detail by ID
    const resDetail = await server.inject({
      method: "GET",
      url: `/api/v1/admin/orders/${order1.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resDetail.statusCode).toBe(200);
    const bodyDetail = resDetail.json();
    expect(bodyDetail.success).toBe(true);
    expect(bodyDetail.data.id).toBe(order1.id);
    expect(bodyDetail.data.items.length).toBe(1);
    expect(bodyDetail.data.buyerMaskedPhone).toBe("*********3210");

    // Test: GET with store filter
    const resStoreA = await server.inject({
      method: "GET",
      url: `/api/v1/admin/orders?storeId=${storeA.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resStoreA.json().data.items.length).toBe(1);
    expect(resStoreA.json().data.items[0].id).toBe(order1.id);

    // Test: GET with status filter
    const resStatusDelivered = await server.inject({
      method: "GET",
      url: "/api/v1/admin/orders?status=DELIVERED",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resStatusDelivered.json().data.items.length).toBe(1);
    expect(resStatusDelivered.json().data.items[0].id).toBe(order2.id);
  });

  it("should force update order status and record in status history and audit log, and return validation error if auditNote is missing", async () => {
    // Setup
    const store = await db.store.create({
      data: {
        name: "Test Store",
        description: "Desc",
        phone: "+919999999000",
        address: "Address",
        storeType: "QUICK_COMMERCE"
      }
    });

    const buyer = await db.user.create({
      data: {
        name: "Buyer",
        phone: "+919876543211",
        isVerified: true
      }
    });

    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: store.id,
        status: "PLACED",
        subtotal: 100.0,
        deliveryFee: 10.0,
        total: 110.0,
        paymentMethod: "COD",
        landmarkDescription: "L1"
      }
    });

    const token = await generateAccessToken("admin-123", "ADMIN");

    // 1. Missing auditNote fails validation
    const resFail = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "CANCELLED" }
    });
    expect(resFail.statusCode).toBe(400);

    // 2. Correct payload succeeds
    const resSuccess = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "CANCELLED", auditNote: "Fraud detected" }
    });
    expect(resSuccess.statusCode).toBe(200);

    // Verify order status
    const updatedOrder = await db.order.findUnique({
      where: { id: order.id },
      include: { statusHistory: true }
    });
    expect(updatedOrder?.status).toBe("CANCELLED");
    const latestHistory = updatedOrder?.statusHistory.find((h) => h.status === "CANCELLED");
    expect(latestHistory).toBeDefined();
    expect(latestHistory?.note).toBe("Fraud detected");
    expect(latestHistory?.changedBy).toBe("admin:admin-123");

    // Verify AuditLog
    const logs = await db.auditLog.findMany({
      where: { entityId: order.id }
    });
    expect(logs.length).toBe(1);
    const log = logs[0];
    expect(log?.action).toBe("ADMIN_FORCE_STATUS_UPDATE");
    expect(log?.actorRole).toBe("ADMIN");
    expect(log?.actorId).toBe("admin-123");
    const newValue = log?.newValue as { status?: string; note?: string } | null;
    expect(newValue?.status).toBe("CANCELLED");
    expect(newValue?.note).toBe("Fraud detected");
  });

  it("should support CSV export endpoint returning content-type text/csv", async () => {
    const store = await db.store.create({
      data: {
        name: "CSV Store",
        description: "Desc",
        phone: "+919999999010",
        address: "Address",
        storeType: "QUICK_COMMERCE"
      }
    });

    const buyer = await db.user.create({
      data: {
        name: "Buyer",
        phone: "+919876543212",
        isVerified: true
      }
    });

    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: store.id,
        status: "PLACED",
        subtotal: 100.0,
        deliveryFee: 10.0,
        total: 110.0,
        paymentMethod: "COD",
        landmarkDescription: "L1"
      }
    });

    const token = await generateAccessToken("admin-123", "ADMIN");

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/orders/export?format=csv",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.body).toContain("Order ID");
    expect(response.body).toContain("CSV Store");
  });
});
