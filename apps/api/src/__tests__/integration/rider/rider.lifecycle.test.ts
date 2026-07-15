import { randomUUID } from "node:crypto";

import { hash } from "bcryptjs";
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
  await db.riderStore.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.deliveryRider.deleteMany();
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

describe("Rider Lifecycle Route Integration", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let storeId1: string;
  let storeId2: string;
  let rider1Id: string;
  let rider2Id: string;
  let riderTokenStore1: string;
  let storeOwnerTokenStore1: string;
  let storeOwnerTokenStore2: string;

  beforeAll(async () => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);

    // Create stores
    const store1 = await db.store.create({
      data: {
        name: "Hillside Mart",
        description: "Hillside description",
        phone: "+919999999991",
        address: "Hillside address"
      }
    });
    storeId1 = store1.id;

    const store2 = await db.store.create({
      data: {
        name: "Mountain Medico",
        description: "Mountain description",
        phone: "+919999999992",
        address: "Mountain address"
      }
    });
    storeId2 = store2.id;

    const passwordHash = await hash("Rider#123", 8);

    // Create riders
    const rider1 = await db.deliveryRider.create({
      data: {
        name: "Test Rider One",
        phone: "+919000000001",
        email: "rider1@gorola.in",
        passwordHash,
        isActive: true
      }
    });
    rider1Id = rider1.id;

    await db.riderStore.create({
      data: {
        riderId: rider1.id,
        storeId: storeId1,
        isPrimary: true
      }
    });

    const rider2 = await db.deliveryRider.create({
      data: {
        name: "Test Rider Two",
        phone: "+919000000002",
        email: "rider2@gorola.in",
        passwordHash,
        isActive: true
      }
    });
    rider2Id = rider2.id;

    await db.riderStore.create({
      data: {
        riderId: rider2.id,
        storeId: storeId2,
        isPrimary: true
      }
    });

    // Create store owners
    const owner1 = await db.storeOwner.create({
      data: {
        email: "owner1@gorola.in",
        passwordHash,
        storeId: storeId1
      }
    });

    const owner2 = await db.storeOwner.create({
      data: {
        email: "owner2@gorola.in",
        passwordHash,
        storeId: storeId2
      }
    });

    // Generate tokens
    riderTokenStore1 = await generateAccessToken(rider1.id, "RIDER", storeId1);
    storeOwnerTokenStore1 = await generateAccessToken(owner1.id, "STORE_OWNER", storeId1);
    storeOwnerTokenStore2 = await generateAccessToken(owner2.id, "STORE_OWNER", storeId2);
  });

  it("PUT /api/v1/rider/orders/:id/accept updates order riderId and status history", async () => {
    // 1. Create a buyer user and an order in PREPARING status
    const buyer = await db.user.create({
      data: { name: "John Buyer", phone: "+919876543210" }
    });

    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Test landmark"
      }
    });

    // 2. Call accept order endpoint
    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/accept`,
      headers: { authorization: `Bearer ${riderTokenStore1}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.riderId).toBe(rider1Id);

    // 3. Verify order in DB
    const dbOrder = await db.order.findUnique({
      where: { id: order.id },
      include: { statusHistory: true }
    });
    expect(dbOrder?.riderId).toBe(rider1Id);

    const acceptHistory = dbOrder?.statusHistory.find(
      (h) => h.changedBy === `rider:${rider1Id}`
    );
    expect(acceptHistory).toBeDefined();
    expect(acceptHistory?.note).toContain("Order accepted by rider: Test Rider One");
  });

  it("PUT /api/v1/rider/orders/:id/accept returns 422 if already assigned", async () => {
    const buyer = await db.user.create({
      data: { name: "John Buyer", phone: "+919876543210" }
    });

    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Test landmark",
        riderId: rider1Id
      }
    });

    // Create another rider for storeId1
    const rider3 = await db.deliveryRider.create({
      data: {
        name: "Test Rider Three",
        phone: "+919000000003",
        email: "rider3@gorola.in",
        passwordHash: "hash",
        isActive: true
      }
    });
    await db.riderStore.create({
      data: {
        riderId: rider3.id,
        storeId: storeId1,
        isPrimary: true
      }
    });
    const tokenRider3 = await generateAccessToken(rider3.id, "RIDER", storeId1);

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/accept`,
      headers: { authorization: `Bearer ${tokenRider3}` }
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("RIDER_ALREADY_ASSIGNED");
  });

  it("PUT /api/v1/rider/orders/:id/status OUT_FOR_DELIVERY returns 422", async () => {
    const buyer = await db.user.create({
      data: { name: "John Buyer", phone: "+919876543210" }
    });

    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Test landmark",
        riderId: rider1Id
      }
    });

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${riderTokenStore1}` },
      payload: { status: "OUT_FOR_DELIVERY" }
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("PUT /api/v1/store/orders/:id/status OUT_FOR_DELIVERY returns 422 if riderId is null", async () => {
    const buyer = await db.user.create({
      data: { name: "John Buyer", phone: "+919876543210" }
    });

    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Test landmark"
      }
    });

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/store/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${storeOwnerTokenStore1}` },
      payload: { status: "OUT_FOR_DELIVERY" }
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("NO_RIDER_ASSIGNED");
  });

  it("PUT /api/v1/store/orders/:id/status DELIVERED returns 422", async () => {
    const buyer = await db.user.create({
      data: { name: "John Buyer", phone: "+919876543210" }
    });

    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "OUT_FOR_DELIVERY",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Test landmark",
        riderId: rider1Id
      }
    });

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/store/orders/${order.id}/status`,
      headers: { authorization: `Bearer ${storeOwnerTokenStore1}` },
      payload: { status: "DELIVERED" }
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("GET /api/v1/orders/:id/rider-location allows assigned STORE_OWNER, blocks others", async () => {
    const buyer = await db.user.create({
      data: { name: "John Buyer", phone: "+919876543210" }
    });

    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "OUT_FOR_DELIVERY",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Test landmark",
        riderId: rider1Id
      }
    });

    await db.riderLocation.create({
      data: {
        riderId: rider1Id,
        lat: 30.45,
        lng: 78.06
      }
    });

    // Authorized store owner
    const resAuth = await server.inject({
      method: "GET",
      url: `/api/v1/orders/${order.id}/rider-location`,
      headers: { authorization: `Bearer ${storeOwnerTokenStore1}` }
    });
    expect(resAuth.statusCode).toBe(200);
    expect(resAuth.json().data.lat).toBe("30.45");

    // Forbidden store owner (from different store)
    const resForbidden = await server.inject({
      method: "GET",
      url: `/api/v1/orders/${order.id}/rider-location`,
      headers: { authorization: `Bearer ${storeOwnerTokenStore2}` }
    });
    expect(resForbidden.statusCode).toBe(403);
  });

  it("GET /api/v1/rider/orders/active filters out orders accepted by other riders and returns extra address & store fields", async () => {
    const buyer = await db.user.create({
      data: { name: "John Buyer", phone: "+919876543210" }
    });

    // Order 1: Accepted by current rider (rider1Id)
    const order1 = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Near Picture Palace",
        flatRoom: "Flat 101",
        deliveryNote: "Leave at door",
        riderId: rider1Id
      }
    });

    // Order 2: Accepted by another rider (rider2Id)
    const order2 = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Clock Tower",
        riderId: rider2Id
      }
    });

    // Order 3: Unaccepted (riderId: null)
    const order3 = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        orderType: "QUICK",
        subtotal: 100,
        deliveryFee: 10,
        total: 110,
        landmarkDescription: "Library Chowk",
        riderId: null
      }
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/rider/orders/active",
      headers: { authorization: `Bearer ${riderTokenStore1}` }
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;

    // Assert filtering: should see order1 and order3, but NOT order2
    const ids = data.map((o: { id: string }) => o.id);
    expect(ids).toContain(order1.id);
    expect(ids).not.toContain(order2.id);
    expect(ids).toContain(order3.id);

    // Assert extra fields mapped correctly on order1
    const mappedOrder1 = data.find((o: { id: string }) => o.id === order1.id) as {
      riderId?: string | null;
      storeName?: string;
      deliveryAddress?: { flatRoom?: string; deliveryNote?: string };
    } | undefined;
    expect(mappedOrder1).toBeDefined();
    expect(mappedOrder1!.riderId).toBe(rider1Id);
    expect(mappedOrder1!.storeName).toBe("Hillside Mart");
    expect(mappedOrder1!.deliveryAddress?.flatRoom).toBe("Flat 101");
    expect(mappedOrder1!.deliveryAddress?.deliveryNote).toBe("Leave at door");
  });
});
