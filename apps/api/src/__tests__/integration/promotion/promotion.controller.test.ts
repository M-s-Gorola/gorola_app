import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

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

async function cleanPromotionGraph(db: PrismaClient): Promise<void> {
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

describe("Promotion controller offers auth", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanPromotionGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("GET /api/v1/promotions/store/:storeId/offers without authorization token -> HTTP 401 UNAUTHORIZED", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/promotions/store/store-123/offers"
    });
    await server.close();

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("GET /api/v1/promotions/store/:storeId/offers with invalid auth token -> HTTP 401 UNAUTHORIZED", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/promotions/store/store-123/offers",
      headers: {
        authorization: "Bearer invalid-token"
      }
    });
    await server.close();

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("GET /api/v1/promotions/store/:storeId/offers with valid BUYER auth token -> HTTP 200 with serialized list of active/inactive offers", async () => {
    const store = await db.store.create({
      data: {
        id: "store-123",
        name: "Test Store",
        description: "Desc",
        phone: "+919999999901",
        address: "Address"
      }
    });

    await db.offer.create({
      data: {
        storeId: store.id,
        title: "FLAT 50 OFF",
        description: "Flat 50 off",
        discountType: "FLAT",
        discountValue: "50",
        minOrderAmount: "200",
        maxDiscount: null,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2027-01-01T00:00:00.000Z"),
        isActive: true
      }
    });

    const buyerToken = await generateAccessToken("buyer-123", "BUYER");

    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/promotions/store/${store.id}/offers`,
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      title: "FLAT 50 OFF",
      discountType: "FLAT",
      discountValue: 50,
      minOrderAmount: 200,
      maxDiscount: null,
      isActive: true
    });
  });

  it("GET /api/v1/promotions/store/:storeId/offers with valid STORE_OWNER auth token -> HTTP 200 with serialized list", async () => {
    const store = await db.store.create({
      data: {
        id: "store-123",
        name: "Test Store",
        description: "Desc",
        phone: "+919999999901",
        address: "Address"
      }
    });

    const storeOwnerToken = await generateAccessToken("owner-123", "STORE_OWNER", store.id);

    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/promotions/store/${store.id}/offers`,
      headers: {
        authorization: `Bearer ${storeOwnerToken}`
      }
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
  });
});
