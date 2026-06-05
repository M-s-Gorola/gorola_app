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

async function cleanCatalog(db: ReturnType<typeof getPrismaClient>): Promise<void> {
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

describe("StoreOwner Categories Integration Tests", () => {
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
    await cleanCatalog(db);
  });

  it("should filter categories fetched by merchant stores to match their commerceType", async () => {
    // 1. Setup Quick Commerce Store & Owner
    const quickStore = await storeRepo.create({
      name: "Quick Store",
      description: "Quick store",
      phone: "+919999999901",
      address: "Quick street",
      storeType: "QUICK_COMMERCE"
    });

    const quickOwner = await ownerRepo.create({
      email: "quick.owner@gorola.in",
      passwordHash: "hash",
      storeId: quickStore.id
    });

    // 2. Setup Booking Commerce Store & Owner
    const bookingStore = await storeRepo.create({
      name: "Booking Store",
      description: "Booking store",
      phone: "+919999999902",
      address: "Booking street",
      storeType: "BOOKING_COMMERCE"
    });

    const bookingOwner = await ownerRepo.create({
      email: "booking.owner@gorola.in",
      passwordHash: "hash",
      storeId: bookingStore.id
    });

    // 3. Setup Categories
    await db.category.create({
      data: {
        slug: "quick-cat",
        name: "Quick Cat",
        commerceType: "QUICK_COMMERCE",
        isActive: true
      }
    });

    await db.category.create({
      data: {
        slug: "booking-cat",
        name: "Booking Cat",
        commerceType: "BOOKING_COMMERCE",
        isActive: true
      }
    });

    // 4. Fetch Categories as Quick Store Owner
    const quickToken = await generateAccessToken(quickOwner.id, "STORE_OWNER", quickStore.id);
    const quickRes = await server.inject({
      method: "GET",
      url: "/api/v1/store/categories",
      headers: {
        authorization: `Bearer ${quickToken}`
      }
    });

    expect(quickRes.statusCode).toBe(200);
    const quickBody = quickRes.json();
    expect(quickBody.success).toBe(true);
    expect(quickBody.data).toHaveLength(1);
    expect(quickBody.data[0].slug).toBe("quick-cat");

    // 5. Fetch Categories as Booking Store Owner
    const bookingToken = await generateAccessToken(bookingOwner.id, "STORE_OWNER", bookingStore.id);
    const bookingRes = await server.inject({
      method: "GET",
      url: "/api/v1/store/categories",
      headers: {
        authorization: `Bearer ${bookingToken}`
      }
    });

    expect(bookingRes.statusCode).toBe(200);
    const bookingBody = bookingRes.json();
    expect(bookingBody.success).toBe(true);
    expect(bookingBody.data).toHaveLength(1);
    expect(bookingBody.data[0].slug).toBe("booking-cat");
  });
});
