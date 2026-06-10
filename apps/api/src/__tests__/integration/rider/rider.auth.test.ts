import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { jwtVerify } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
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
  await db.admin.deleteMany();
}

describe("RiderAuth Route Integration", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let storeId: string;
  const keys = resolveBuyerJwtKeyPair();

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

    // Seed a store for the rider
    const store = await db.store.create({
      data: {
        name: "Test Store",
        description: "Test description",
        phone: "+919999999999",
        address: "Test address"
      }
    });
    storeId = store.id;
  });

  it("POST /api/v1/rider/auth/login with correct credentials → HTTP 200 with tokens and valid JWT", async () => {
    const passwordHash = await hash("correct_pass", 8);

    const rider = await db.deliveryRider.create({
      data: {
        name: "Test Rider",
        phone: "+919000000001",
        email: "rider@test.com",
        passwordHash,
        storeId,
        isActive: true
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/rider/auth/login",
      payload: {
        email: "rider@test.com",
        password: "correct_pass"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();

    // Verify JWT payload
    const { payload } = await jwtVerify(body.data.accessToken, keys.publicKey, {
      algorithms: ["RS256"]
    });
    expect(payload.role).toBe("RIDER");
    expect(payload.storeId).toBe(storeId);
    expect(payload.sub).toBe(rider.id);
  });

  it("POST /api/v1/rider/auth/login with wrong password → HTTP 401 AUTH_FAILED", async () => {
    const passwordHash = await hash("correct_pass", 8);

    await db.deliveryRider.create({
      data: {
        name: "Test Rider",
        phone: "+919000000001",
        email: "rider@test.com",
        passwordHash,
        storeId,
        isActive: true
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/rider/auth/login",
      payload: {
        email: "rider@test.com",
        password: "wrong_pass"
      }
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FAILED");
  });

  it("POST /api/v1/rider/auth/login for inactive rider (isActive: false) → HTTP 403 ACCOUNT_SUSPENDED", async () => {
    const passwordHash = await hash("correct_pass", 8);

    await db.deliveryRider.create({
      data: {
        name: "Suspended Rider",
        phone: "+919000000002",
        email: "rider.suspended@test.com",
        passwordHash,
        storeId,
        isActive: false
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/rider/auth/login",
      payload: {
        email: "rider.suspended@test.com",
        password: "correct_pass"
      }
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("GET /api/v1/rider/profile with valid token → HTTP 200 with rider and store details", async () => {
    const passwordHash = await hash("correct_pass", 8);

    const rider = await db.deliveryRider.create({
      data: {
        name: "Test Rider Profile",
        phone: "+919000000003",
        email: "rider.profile@test.com",
        passwordHash,
        storeId,
        isActive: true
      }
    });

    // Login to get token
    const loginRes = await server.inject({
      method: "POST",
      url: "/api/v1/rider/auth/login",
      payload: {
        email: "rider.profile@test.com",
        password: "correct_pass"
      }
    });
    const accessToken = loginRes.json().data.accessToken;

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/rider/profile",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(rider.id);
    expect(body.data.name).toBe("Test Rider Profile");
    expect(body.data.email).toBe("rider.profile@test.com");
    expect(body.data.store.id).toBe(storeId);
    expect(body.data.store.name).toBe("Test Store");
  });

  it("GET /api/v1/rider/profile without token → HTTP 401", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/rider/profile"
    });
    expect(response.statusCode).toBe(401);
  });
});
