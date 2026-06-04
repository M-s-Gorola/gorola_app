import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function generateAccessToken(userId: string, role: string): Promise<string> {
  const keys = resolveBuyerJwtKeyPair();
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keys.privateKey);
}

describe("Admin Stores API Integration Tests", () => {
  let server: FastifyInstance;
  const db = getPrismaClient();
  let adminToken: string;

  beforeAll(async () => {
    server = await createServer();
    registerAppRoutes(server);
    adminToken = await generateAccessToken("admin-123", "ADMIN");
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    // Clear relevant records — order matters (FK constraints)
    await db.cartItem.deleteMany();
    await db.cart.deleteMany();
    await db.orderItem.deleteMany();
    await db.order.deleteMany();
    await db.address.deleteMany();    // must come before user (FK: Address_userId_fkey)
    await db.user.deleteMany();       // must come after orders (FK: order.userId)
    await db.productVariant.deleteMany();
    await db.product.deleteMany();
    await db.storeOwner.deleteMany();
    await db.advertisement.deleteMany();
    await db.offer.deleteMany();
    await db.discount.deleteMany();
    await db.store.deleteMany();
    await db.auditLog.deleteMany();
  });

  it("should enforce ADMIN role authorization", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/admin/stores",
      headers: { authorization: `Bearer ${buyerToken}` }
    });
    expect(res.statusCode).toBe(403);
  });

  it("should create new store and owner atomically and prevent duplicate owner emails", async () => {
    const payload = {
      storeName: "Fresh Veggie Palace",
      description: "Organic veggies straight from farms",
      phone: "+919999888877",
      landmarkAddress: "Sector 15, Near Metro Stn",
      storeType: "QUICK_COMMERCE",
      ownerEmail: "veggie_owner@test.com",
      ownerTempPassword: "SuperSecurePass123!"
    };

    // 1. Valid creation
    const resCreate = await server.inject({
      method: "POST",
      url: "/api/v1/admin/stores",
      headers: { authorization: `Bearer ${adminToken}` },
      payload
    });

    expect(resCreate.statusCode).toBe(201);
    const bodyCreate = resCreate.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.data.storeId).toBeDefined();
    expect(bodyCreate.data.storeType).toBe("QUICK_COMMERCE");
    expect(bodyCreate.data.ownerId).toBeDefined();

    // Verify DB
    const dbStore = await db.store.findUnique({
      where: { id: bodyCreate.data.storeId },
      include: { owners: true }
    });
    expect(dbStore).toBeDefined();
    expect(dbStore?.name).toBe("Fresh Veggie Palace");
    expect(dbStore?.storeType).toBe("QUICK_COMMERCE");
    expect(dbStore?.owners.length).toBe(1);
    expect(dbStore?.owners[0]?.email).toBe("veggie_owner@test.com");

    // Verify AuditLog
    const auditLogs = await db.auditLog.findMany({
      where: { entityId: bodyCreate.data.storeId }
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.action).toBe("ADMIN_STORE_CREATE");
    expect(auditLogs[0]?.actorId).toBe("admin-123");

    // 2. Attempt duplicate email
    const resDup = await server.inject({
      method: "POST",
      url: "/api/v1/admin/stores",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        ...payload,
        storeName: "Another Store Name"
      }
    });
    expect(resDup.statusCode).toBe(409);
    expect(resDup.json().error.message).toContain("email");
  });

  it("should validate required storeType", async () => {
    const payloadMissingType = {
      storeName: "Veggies",
      phone: "+919999888877",
      landmarkAddress: "Sector 15",
      ownerEmail: "owner_missing@test.com",
      ownerTempPassword: "PassPassword1!"
    };

    const res = await server.inject({
      method: "POST",
      url: "/api/v1/admin/stores",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: payloadMissingType
    });
    expect(res.statusCode).toBe(400);

    const payloadInvalidType = {
      ...payloadMissingType,
      storeType: "INVALID_COMMERCE"
    };

    const res2 = await server.inject({
      method: "POST",
      url: "/api/v1/admin/stores",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: payloadInvalidType
    });
    expect(res2.statusCode).toBe(400);
  });

  it("should fetch all stores and details", async () => {
    // Seed a store
    const store = await db.store.create({
      data: {
        name: "Test Store 1",
        description: "Desc",
        phone: "+91000",
        address: "Address",
        storeType: "BOOKING_COMMERCE"
      }
    });

    await db.storeOwner.create({
      data: {
        email: "test_owner_1@test.com",
        passwordHash: "hash",
        storeId: store.id
      }
    });

    // Seed products & orders
    const category = await db.category.create({
      data: { name: "Veg", slug: "veg" }
    });
    const subCategory = await db.subCategory.create({
      data: { name: "Green Veg", slug: "green-veg", categoryId: category.id }
    });
    const product = await db.product.create({
      data: { name: "Spinach", description: "Spinach description", imageUrl: "https://example.com/spinach.jpg", storeId: store.id, categoryId: category.id, subCategoryId: subCategory.id }
    });
    await db.productVariant.create({
      data: { label: "1kg", price: 40.00, unit: "kg", stockQty: 10, productId: product.id }
    });

    const user = await db.user.create({
      data: { phone: "+919876543210", name: "Buyer" }
    });
    await db.order.create({
      data: {
        userId: user.id,
        storeId: store.id,
        subtotal: 40.00,
        deliveryFee: 10.00,
        total: 50.00,
        paymentMethod: "COD",
        landmarkDescription: "Test Address"
      }
    });

    // 1. GET all stores
    const resAll = await server.inject({
      method: "GET",
      url: "/api/v1/admin/stores",
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(resAll.statusCode).toBe(200);
    const bodyAll = resAll.json();
    expect(bodyAll.data.length).toBe(1);
    expect(bodyAll.data[0].name).toBe("Test Store 1");
    expect(bodyAll.data[0].ownerEmail).toBe("test_owner_1@test.com");
    expect(bodyAll.data[0].productCount).toBe(1);
    expect(bodyAll.data[0].orderCount).toBe(1);
    expect(bodyAll.data[0].revenue).toBe(50.00);

    // 2. GET detail
    const resDetail = await server.inject({
      method: "GET",
      url: `/api/v1/admin/stores/${store.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(resDetail.statusCode).toBe(200);
    const bodyDetail = resDetail.json();
    expect(bodyDetail.data.name).toBe("Test Store 1");
    expect(bodyDetail.data.storeType).toBe("BOOKING_COMMERCE");
    expect(bodyDetail.data.owners.length).toBe(1);
    expect(bodyDetail.data.owners[0].email).toBe("test_owner_1@test.com");
  });

  it("should suspend / unsuspend store status and audit logs, and gate buyer storefronts", async () => {
    // Setup store
    const store = await db.store.create({
      data: {
        name: "Gated Store",
        description: "Desc",
        phone: "+91111",
        address: "Address",
        storeType: "QUICK_COMMERCE",
        isActive: true
      }
    });
    const category = await db.category.create({
      data: { name: "Gated Veg", slug: "gated-veg" }
    });
    const subCategory = await db.subCategory.create({
      data: { name: "Spin", slug: "spin", categoryId: category.id }
    });
    const product = await db.product.create({
      data: { name: "Gated Spinach", description: "Spinach description", imageUrl: "https://example.com/spinach.jpg", storeId: store.id, categoryId: category.id, subCategoryId: subCategory.id, isActive: true }
    });
    await db.productVariant.create({
      data: { label: "1kg", price: 30, unit: "kg", stockQty: 50, productId: product.id }
    });

    // 1. Deactivate store
    const resDeact = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/stores/${store.id}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: false }
    });
    expect(resDeact.statusCode).toBe(200);
    expect(resDeact.json().data.isActive).toBe(false);

    // Verify DB
    const dbStoreDeact = await db.store.findUnique({ where: { id: store.id } });
    expect(dbStoreDeact?.isActive).toBe(false);

    // Verify AuditLog
    const logsDeact = await db.auditLog.findMany({
      where: { entityId: store.id, action: "ADMIN_STORE_DEACTIVATE" }
    });
    expect(logsDeact.length).toBe(1);
    expect(logsDeact[0]?.actorId).toBe("admin-123");

    // Verify storefront product list filters it out
    const resProductsBuyer1 = await server.inject({
      method: "GET",
      url: `/api/v1/products?storeId=${store.id}`
    });
    expect(resProductsBuyer1.statusCode).toBe(200);
    expect(resProductsBuyer1.json().data.items.length).toBe(0);

    // Verify category listing details filters it out
    const resCategories = await server.inject({
      method: "GET",
      url: "/api/v1/categories"
    });
    expect(resCategories.statusCode).toBe(200);
    const gatedCat = resCategories.json().data.find((c: { id: string }) => c.id === category.id);
    expect((gatedCat as { productCount?: number } | undefined)?.productCount).toBe(0); // Spinach does not count since store is inactive

    // 2. Reactivate store
    const resReact = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/stores/${store.id}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: true }
    });
    expect(resReact.statusCode).toBe(200);
    expect(resReact.json().data.isActive).toBe(true);

    // Verify storefront product list returns product again
    const resProductsBuyer2 = await server.inject({
      method: "GET",
      url: `/api/v1/products?storeId=${store.id}`
    });
    expect(resProductsBuyer2.statusCode).toBe(200);
    expect(resProductsBuyer2.json().data.items.length).toBe(1);
    expect(resProductsBuyer2.json().data.items[0].name).toBe("Gated Spinach");

    // Verify category product count counts it again
    const resCategories2 = await server.inject({
      method: "GET",
      url: "/api/v1/categories"
    });
    const gatedCat2 = resCategories2.json().data.find((c: { id: string }) => c.id === category.id);
    expect((gatedCat2 as { productCount?: number } | undefined)?.productCount).toBe(1);
  });
});
