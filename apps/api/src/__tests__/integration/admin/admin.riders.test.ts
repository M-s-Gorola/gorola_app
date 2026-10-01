import { randomUUID } from "node:crypto";

import type { Store } from "@prisma/client";
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

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.bookingOrder.deleteMany();
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
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
  await db.admin.deleteMany();
}

describe("Admin Riders Integration Tests", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let qcStore: Store;
  let bookingStore: Store;
  let adminToken: string;

  beforeAll(async () => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    await server.ready();
    adminToken = await generateAccessToken("admin-123", "ADMIN");
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);

    qcStore = await db.store.create({
      data: {
        name: "Quick Commerce Store",
        description: "QC description",
        phone: "+919999999901",
        address: "QC address",
        storeType: "QUICK_COMMERCE"
      }
    });

    bookingStore = await db.store.create({
      data: {
        name: "Booking Commerce Store",
        description: "Booking description",
        phone: "+919999999902",
        address: "Booking address",
        storeType: "BOOKING_COMMERCE"
      }
    });
  });

  it("GET /api/v1/admin/riders should list riders including store relation details", async () => {
    const rider = await db.deliveryRider.create({
      data: {
        name: "Existing Delivery Rider",
        phone: "+919000000010",
        email: "rider.ex@gorola.in",
        passwordHash: "hash123",
        riderType: "DELIVERY",
        isActive: true,
        stores: {
          create: {
            storeId: qcStore.id,
            isPrimary: true
          }
        }
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/riders",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(rider.id);
    expect(body.data[0].stores.length).toBe(1);
    expect(body.data[0].stores[0].storeId).toBe(qcStore.id);
    expect(body.data[0].stores[0].store.name).toBe("Quick Commerce Store");
  });

  it("POST /api/v1/admin/riders should create a DELIVERY rider mapped to a QUICK_COMMERCE store", async () => {
    const payload = {
      name: "New Delivery Rider",
      phone: "+919000000011",
      email: "new.rider@gorola.in",
      password: "RiderPassword123",
      riderType: "DELIVERY",
      storeIds: [qcStore.id],
      primaryStoreId: qcStore.id
    };

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/admin/riders",
      payload,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.email).toBe("new.rider@gorola.in");

    // Verify DB
    const riderDb = await db.deliveryRider.findUnique({
      where: { email: "new.rider@gorola.in" },
      include: { stores: true }
    });
    expect(riderDb).not.toBeNull();
    expect(riderDb?.riderType).toBe("DELIVERY");
    expect(riderDb?.stores?.length).toBe(1);
    expect(riderDb?.stores?.[0]?.storeId).toBe(qcStore.id);
    expect(riderDb?.stores?.[0]?.isPrimary).toBe(true);
  });

  it("POST /api/v1/admin/riders should reject DELIVERY rider assignment to BOOKING_COMMERCE store", async () => {
    const payload = {
      name: "Invalid Delivery Rider",
      phone: "+919000000012",
      email: "invalid.rider@gorola.in",
      password: "RiderPassword123",
      riderType: "DELIVERY",
      storeIds: [bookingStore.id],
      primaryStoreId: bookingStore.id
    };

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/admin/riders",
      payload,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().success).toBe(false);
  });

  it("POST /api/v1/admin/riders should create a FIELD_TECHNICIAN rider mapped to a BOOKING_COMMERCE store", async () => {
    const payload = {
      name: "New Field Tech",
      phone: "+919000000013",
      email: "new.tech@gorola.in",
      password: "RiderPassword123",
      riderType: "FIELD_TECHNICIAN",
      storeIds: [bookingStore.id],
      primaryStoreId: bookingStore.id
    };

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/admin/riders",
      payload,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);

    const riderDb = await db.deliveryRider.findUnique({
      where: { email: "new.tech@gorola.in" },
      include: { stores: true }
    });
    expect(riderDb).not.toBeNull();
    expect(riderDb?.riderType).toBe("FIELD_TECHNICIAN");
    expect(riderDb?.stores?.[0]?.storeId).toBe(bookingStore.id);
  });

  it("PUT /api/v1/admin/riders/:id should update status and store mappings of a rider", async () => {
    const rider = await db.deliveryRider.create({
      data: {
        name: "Rider To Edit",
        phone: "+919000000014",
        email: "edit.rider@gorola.in",
        passwordHash: "hash123",
        riderType: "DELIVERY",
        isActive: true,
        stores: {
          create: {
            storeId: qcStore.id,
            isPrimary: true
          }
        }
      }
    });

    // Create another QC store to add
    const qcStore2 = await db.store.create({
      data: {
        name: "Second QC Store",
        description: "QC description",
        phone: "+919999999903",
        address: "QC address 2",
        storeType: "QUICK_COMMERCE"
      }
    });

    const payload = {
      isActive: false,
      storeIds: [qcStore2.id],
      primaryStoreId: qcStore2.id
    };

    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/riders/${rider.id}`,
      payload,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);

    // Verify DB
    const updatedRider = await db.deliveryRider.findUnique({
      where: { id: rider.id },
      include: { stores: true }
    });
    expect(updatedRider?.isActive).toBe(false);
    expect(updatedRider?.stores?.length).toBe(1);
    expect(updatedRider?.stores?.[0]?.storeId).toBe(qcStore2.id);
    expect(updatedRider?.stores?.[0]?.isPrimary).toBe(true);
  });

  it("GET /api/v1/admin/riders/:id should return detailed rider profile and metrics", async () => {
    const rider = await db.deliveryRider.create({
      data: {
        name: "Express Rider",
        phone: "+919000000015",
        email: "express.rider@gorola.in",
        passwordHash: "hash123",
        riderType: "DELIVERY",
        isActive: true,
        stores: {
          create: {
            storeId: qcStore.id,
            isPrimary: true
          }
        }
      }
    });

    const buyer = await db.user.create({
      data: { name: "Buyer 1", phone: "+919876543209", isVerified: true }
    });

    // Create 2 completed orders with earnings
    const order1 = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: qcStore.id,
        riderId: rider.id,
        status: "DELIVERED",
        subtotal: 300,
        deliveryFee: 30,
        total: 330,
        paymentMethod: "COD",
        landmarkDescription: "Loc 1"
      }
    });

    await db.riderEarning.create({
      data: {
        riderId: rider.id,
        orderId: order1.id,
        amount: 25.0
      }
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/admin/riders/${rider.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(rider.id);
    expect(body.data.name).toBe("Express Rider");
    expect(body.data.email).toBe("express.rider@gorola.in");
    expect(body.data.maskedPhone).toBe("*********0015");
    expect(body.data.primaryStoreId).toBe(qcStore.id);
    expect(body.data.primaryStoreName).toBe(qcStore.name);
    expect(body.data.totalDeliveries).toBe(1);
    expect(body.data.totalEarnings).toBe(25);
  });

  it("GET /api/v1/admin/riders/:id should return 404 for non-existent rider ID", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/riders/nonexistent_rider_id_123",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(404);
  });

  it("GET /api/v1/admin/riders/:id/orders should return paginated orders delivered by rider", async () => {
    const rider = await db.deliveryRider.create({
      data: {
        name: "Order Test Rider",
        phone: "+919000000016",
        email: "order.rider@gorola.in",
        passwordHash: "hash123",
        riderType: "DELIVERY",
        isActive: true
      }
    });

    const buyer = await db.user.create({
      data: { name: "Buyer 2", phone: "+919876543210", isVerified: true }
    });

    await db.order.createMany({
      data: [
        {
          userId: buyer.id,
          storeId: qcStore.id,
          riderId: rider.id,
          status: "DELIVERED",
          subtotal: 100,
          deliveryFee: 20,
          total: 120,
          paymentMethod: "COD",
          landmarkDescription: "Loc A"
        },
        {
          userId: buyer.id,
          storeId: qcStore.id,
          riderId: rider.id,
          status: "DELIVERED",
          subtotal: 200,
          deliveryFee: 20,
          total: 220,
          paymentMethod: "UPI",
          landmarkDescription: "Loc B"
        }
      ]
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/admin/riders/${rider.id}/orders?page=1&limit=1`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(2);
    expect(body.data.totalPages).toBe(2);
    expect(body.data.page).toBe(1);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].storeName).toBe(qcStore.name);
  });
});

