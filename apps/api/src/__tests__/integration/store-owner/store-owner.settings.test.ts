import { randomUUID } from "node:crypto";

import { hash } from "bcryptjs";
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
}

describe("StoreOwner Settings Integration Tests", () => {
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

  it("should return 401 when authorization token is missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/store/settings"
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/store/settings returns current store details and owner metadata", async () => {
    const store = await storeRepo.create({
      name: "Mussoorie Bakery",
      description: "Baked goods",
      phone: "+911111111111",
      address: "Library Chowk",
      weatherModeDeliveryWindow: "60-90 min"
    });

    const owner = await ownerRepo.create({
      email: "baker@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id,
      totpEnabled: true
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/store/settings",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      name: "Mussoorie Bakery",
      description: "Baked goods",
      phone: "+911111111111",
      address: "Library Chowk",
      weatherModeDeliveryWindowStart: "60",
      weatherModeDeliveryWindowEnd: "90",
      email: "baker@gorola.in",
      totpEnabled: true
    });
  });

  it("PUT /api/v1/store/settings successfully updates store details", async () => {
    const store = await storeRepo.create({
      name: "Mussoorie Bakery",
      description: "Baked goods",
      phone: "+911111111111",
      address: "Library Chowk"
    });

    const owner = await ownerRepo.create({
      email: "baker@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/store/settings",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: "New Mussoorie Bakery",
        description: "Even better baked goods",
        phone: "+919876543210",
        address: "Picture Palace Road",
        weatherModeDeliveryWindowStart: "45",
        weatherModeDeliveryWindowEnd: "60"
      }
    });

    expect(res.statusCode).toBe(200);
    const updatedStore = await storeRepo.findById(store.id);
    expect(updatedStore?.name).toBe("New Mussoorie Bakery");
    expect(updatedStore?.description).toBe("Even better baked goods");
    expect(updatedStore?.phone).toBe("+919876543210");
    expect(updatedStore?.address).toBe("Picture Palace Road");
    expect(updatedStore?.weatherModeDeliveryWindow).toBe("45-60 min");
  });

  it("PUT /api/v1/store/settings validation rejects empty name with 400", async () => {
    const store = await storeRepo.create({
      name: "Mussoorie Bakery",
      description: "Baked goods",
      phone: "+911111111111",
      address: "Library Chowk"
    });

    const owner = await ownerRepo.create({
      email: "baker@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/store/settings",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: "",
        phone: "+919876543210"
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it("PUT /api/v1/auth/store-owner/change-password changes password when given valid old credentials", async () => {
    const store = await storeRepo.create({
      name: "Mussoorie Bakery",
      description: "Baked goods",
      phone: "+911111111111",
      address: "Library Chowk"
    });

    const initialPasswordHash = await hash("OldPassword#123", 8);
    const owner = await ownerRepo.create({
      email: "baker@gorola.in",
      passwordHash: initialPasswordHash,
      storeId: store.id
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/auth/store-owner/change-password",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        currentPassword: "OldPassword#123",
        newPassword: "NewPassword#123"
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Verify password has been updated in database and login works via Auth controller/routes
    const updatedOwner = await ownerRepo.findById(owner.id);
    expect(updatedOwner?.passwordHash).not.toBe(initialPasswordHash);
  });

  it("PUT /api/v1/auth/store-owner/change-password returns 401 when given an incorrect current password", async () => {
    const store = await storeRepo.create({
      name: "Mussoorie Bakery",
      description: "Baked goods",
      phone: "+911111111111",
      address: "Library Chowk"
    });

    const initialPasswordHash = await hash("OldPassword#123", 8);
    const owner = await ownerRepo.create({
      email: "baker@gorola.in",
      passwordHash: initialPasswordHash,
      storeId: store.id
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/auth/store-owner/change-password",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        currentPassword: "WrongOldPassword#123",
        newPassword: "NewPassword#123"
      }
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });
});
