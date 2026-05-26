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

describe("StoreOwner Offers Integration Tests", () => {
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

  it("should return 401 Unauthorized when authorization token is missing for offers", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/offers"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER rather than STORE_OWNER", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/offers",
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should allow both QUICK_COMMERCE and BOOKING_COMMERCE store owners to manage offers with strict isolation", async () => {
    // 1. Setup Store A (QUICK_COMMERCE) & Store B (BOOKING_COMMERCE)
    const storeA = await storeRepo.create({
      name: "Grocery Store A",
      description: "Quick Commerce Groceries",
      phone: "+919999999901",
      address: "Store A Street",
      storeType: "QUICK_COMMERCE"
    });

    const storeB = await storeRepo.create({
      name: "Repairs Store B",
      description: "Booking Commerce Repairs",
      phone: "+919999999902",
      address: "Store B Street",
      storeType: "BOOKING_COMMERCE"
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

    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);
    const tokenB = await generateAccessToken(ownerB.id, "STORE_OWNER", storeB.id);

    // 3. Create offer for Store A (Quick Commerce)
    const startsAt = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const endsAt = new Date(Date.now() + 86400000 * 5).toISOString(); // 5 days from now

    const postResA = await server.inject({
      method: "POST",
      url: "/api/v1/store/offers",
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        title: "Weekend Dairy Deal",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt,
        endsAt
      }
    });

    expect(postResA.statusCode).toBe(201);
    const postBodyA = postResA.json();
    expect(postBodyA.success).toBe(true);
    expect(postBodyA.data).toMatchObject({
      title: "Weekend Dairy Deal",
      discountType: "PERCENTAGE",
      isActive: true
    });
    expect(postBodyA.data.id).toBeDefined();

    // 4. Create offer for Store B (Booking Commerce)
    const postResB = await server.inject({
      method: "POST",
      url: "/api/v1/store/offers",
      headers: {
        authorization: `Bearer ${tokenB}`
      },
      payload: {
        title: "Weekend Service Deal",
        discountType: "FLAT",
        discountValue: 150,
        startsAt,
        endsAt
      }
    });

    expect(postResB.statusCode).toBe(201);
    const postBodyB = postResB.json();
    expect(postBodyB.success).toBe(true);
    expect(postBodyB.data.title).toBe("Weekend Service Deal");

    // 5. Get offers for Store A owner -> should return ONLY Store A's offer
    const getResA = await server.inject({
      method: "GET",
      url: "/api/v1/store/offers",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(getResA.statusCode).toBe(200);
    const getBodyA = getResA.json();
    expect(getBodyA.success).toBe(true);
    expect(getBodyA.data).toHaveLength(1);
    expect(getBodyA.data[0].id).toBe(postBodyA.data.id);
    expect(getBodyA.data[0].title).toBe("Weekend Dairy Deal");
    expect(getBodyA.data[0]).toHaveProperty("discountType", "PERCENTAGE");
    expect(getBodyA.data[0]).toHaveProperty("isActive", true);
    expect(getBodyA.data[0]).toHaveProperty("startsAt");
    expect(getBodyA.data[0]).toHaveProperty("endsAt");

    // 6. Get offers for Store B owner -> should return ONLY Store B's offer
    const getResB = await server.inject({
      method: "GET",
      url: "/api/v1/store/offers",
      headers: {
        authorization: `Bearer ${tokenB}`
      }
    });

    expect(getResB.statusCode).toBe(200);
    const getBodyB = getResB.json();
    expect(getBodyB.success).toBe(true);
    expect(getBodyB.data).toHaveLength(1);
    expect(getBodyB.data[0].id).toBe(postBodyB.data.id);
  });

  it("should fail validation if startsAt is after endsAt", async () => {
    const store = await storeRepo.create({
      name: "Store",
      description: "Quick Commerce",
      phone: "+919999999901",
      address: "Store Street"
    });

    const owner = await ownerRepo.create({
      email: "owner@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/offers",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        title: "Invalid Dates Sale",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt: new Date(Date.now() + 86400000 * 2).toISOString(), // tomorrow + 2
        endsAt: new Date(Date.now() + 86400000).toISOString() // tomorrow
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("should fail validation if discountValue > 100 on PERCENTAGE", async () => {
    const store = await storeRepo.create({
      name: "Store",
      description: "Quick Commerce",
      phone: "+919999999901",
      address: "Store Street"
    });

    const owner = await ownerRepo.create({
      email: "owner@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/offers",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        title: "Impossible Percent Sale",
        discountType: "PERCENTAGE",
        discountValue: 150,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString()
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("should deactivate an offer successfully", async () => {
    const store = await storeRepo.create({
      name: "Store",
      description: "Quick Commerce",
      phone: "+919999999901",
      address: "Store Street"
    });

    const owner = await ownerRepo.create({
      email: "owner@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    // Create active offer directly in DB
    const offer = await db.offer.create({
      data: {
        storeId: store.id,
        title: "Dairy Markdown",
        description: "10% off",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
        isActive: true
      }
    });

    const deactivateRes = await server.inject({
      method: "PUT",
      url: `/api/v1/store/offers/${offer.id}/deactivate`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(deactivateRes.statusCode).toBe(200);
    expect(deactivateRes.json().success).toBe(true);

    // Verify status updated in DB
    const dbOffer = await db.offer.findUnique({
      where: { id: offer.id }
    });
    expect(dbOffer?.isActive).toBe(false);
  });

  it("should return 403 Forbidden when store owner attempts to deactivate another store's offer", async () => {
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Quick Commerce",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Quick Commerce",
      phone: "+919999999902",
      address: "Store B Street"
    });

    const ownerA = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeA.id
    });

    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);

    // Create active offer in Store B
    const offerB = await db.offer.create({
      data: {
        storeId: storeB.id,
        title: "Store B Deal",
        description: "Flat 100 off",
        discountType: "FLAT",
        discountValue: 100,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
        isActive: true
      }
    });

    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/store/offers/${offerB.id}/deactivate`,
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });
});
