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

describe("StoreOwner Advertisements Integration Tests", () => {
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

  it("should return 401 Unauthorized when authorization token is missing for advertisements", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/advertisements"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER rather than STORE_OWNER", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/advertisements",
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should allow both QUICK_COMMERCE and BOOKING_COMMERCE store owners to manage advertisements with strict isolation", async () => {
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

    // 3. Create advertisement for Store A (Quick Commerce)
    const startsAt = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const endsAt = new Date(Date.now() + 86400000 * 5).toISOString(); // 5 days from now
    
    const postResA = await server.inject({
      method: "POST",
      url: "/api/v1/store/advertisements",
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        imageUrl: "https://example.com/ad-a.png",
        title: "Grocery Summer Sale",
        startsAt,
        endsAt
      }
    });

    expect(postResA.statusCode).toBe(201);
    const postBodyA = postResA.json();
    expect(postBodyA.success).toBe(true);
    expect(postBodyA.data).toMatchObject({
      title: "Grocery Summer Sale",
      imageUrl: "https://example.com/ad-a.png",
      isApproved: false,
      isActive: true
    });
    expect(postBodyA.data.id).toBeDefined();

    // 4. Create advertisement for Store B (Booking Commerce)
    const postResB = await server.inject({
      method: "POST",
      url: "/api/v1/store/advertisements",
      headers: {
        authorization: `Bearer ${tokenB}`
      },
      payload: {
        imageUrl: "https://example.com/ad-b.png",
        title: "Repair Discount Week",
        startsAt,
        endsAt
      }
    });

    expect(postResB.statusCode).toBe(201);
    const postBodyB = postResB.json();
    expect(postBodyB.success).toBe(true);
    expect(postBodyB.data.title).toBe("Repair Discount Week");

    // 5. Get ads for Store A owner -> should return ONLY Store A's ad
    const getResA = await server.inject({
      method: "GET",
      url: "/api/v1/store/advertisements",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(getResA.statusCode).toBe(200);
    const getBodyA = getResA.json();
    expect(getBodyA.success).toBe(true);
    expect(getBodyA.data).toHaveLength(1);
    expect(getBodyA.data[0].id).toBe(postBodyA.data.id);
    expect(getBodyA.data[0].title).toBe("Grocery Summer Sale");
    expect(getBodyA.data[0]).toHaveProperty("isApproved");
    expect(getBodyA.data[0]).toHaveProperty("isActive");
    expect(getBodyA.data[0]).toHaveProperty("startsAt");
    expect(getBodyA.data[0]).toHaveProperty("endsAt");

    // 6. Get ads for Store B owner -> should return ONLY Store B's ad
    const getResB = await server.inject({
      method: "GET",
      url: "/api/v1/store/advertisements",
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
      url: "/api/v1/store/advertisements",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        imageUrl: "https://example.com/ad.png",
        title: "Invalid Dates Sale",
        startsAt: new Date(Date.now() + 86400000 * 2).toISOString(), // tomorrow + 2
        endsAt: new Date(Date.now() + 86400000).toISOString() // tomorrow
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("should delete an unapproved advertisement successfully", async () => {
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

    // Create ad directly via DB (unapproved by default)
    const ad = await db.advertisement.create({
      data: {
        storeId: store.id,
        title: "Unapproved Sale",
        imageUrl: "https://example.com/ad.png",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000)
      }
    });

    const deleteRes = await server.inject({
      method: "DELETE",
      url: `/api/v1/store/advertisements/${ad.id}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().success).toBe(true);

    // Verify it is gone from DB
    const dbAd = await db.advertisement.findUnique({
      where: { id: ad.id }
    });
    expect(dbAd).toBeNull();
  });

  it("should block deletion of approved advertisements and return HTTP 422 with CANNOT_DELETE_APPROVED_AD", async () => {
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

    // Create an approved ad
    const ad = await db.advertisement.create({
      data: {
        storeId: store.id,
        title: "Approved Sale",
        imageUrl: "https://example.com/ad.png",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
        isApproved: true
      }
    });

    const deleteRes = await server.inject({
      method: "DELETE",
      url: `/api/v1/store/advertisements/${ad.id}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(deleteRes.statusCode).toBe(422);
    expect(deleteRes.json().success).toBe(false);
    expect(deleteRes.json().error.code).toBe("CANNOT_DELETE_APPROVED_AD");

    // Verify it is still in the DB
    const dbAd = await db.advertisement.findUnique({
      where: { id: ad.id }
    });
    expect(dbAd).not.toBeNull();
  });

  it("should return 403 Forbidden when store owner attempts to delete another store's advertisement", async () => {
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

    // Ad belongs to Store B
    const adB = await db.advertisement.create({
      data: {
        storeId: storeB.id,
        title: "Store B Ad",
        imageUrl: "https://example.com/ad.png",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000)
      }
    });

    const response = await server.inject({
      method: "DELETE",
      url: `/api/v1/store/advertisements/${adB.id}`,
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });
});
