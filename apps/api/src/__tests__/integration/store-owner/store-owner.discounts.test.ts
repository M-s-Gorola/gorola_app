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

describe("StoreOwner Discounts Integration Tests", () => {
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

  it("should return 401 Unauthorized when authorization token is missing for discounts", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/discounts"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER rather than STORE_OWNER", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should allow store owners to manage discounts with strict isolation", async () => {
    // 1. Setup Store A & Store B
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Quick Commerce Store A",
      phone: "+919999999901",
      address: "Store A Address",
      storeType: "QUICK_COMMERCE"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Booking Commerce Store B",
      phone: "+919999999902",
      address: "Store B Address",
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

    const startsAt = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const endsAt = new Date(Date.now() + 86400000 * 5).toISOString(); // 5 days from now

    // 3. Create discount code for Store A
    const postResA = await server.inject({
      method: "POST",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        code: "save10", // lowercase code input to verify uppercase normalization
        discountType: "PERCENTAGE",
        discountValue: 10,
        maxUsageCount: 100,
        startsAt,
        endsAt
      }
    });

    expect(postResA.statusCode).toBe(201);
    const postBodyA = postResA.json();
    expect(postBodyA.success).toBe(true);
    expect(postBodyA.data).toMatchObject({
      code: "SAVE10", // normalized
      discountType: "PERCENTAGE",
      isActive: true,
      usedCount: 0,
      maxUsageCount: 100
    });
    expect(postBodyA.data.id).toBeDefined();

    // 4. Try duplicate coupon code for same store -> conflict 409
    const dupRes = await server.inject({
      method: "POST",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        code: "save10",
        discountType: "FLAT",
        discountValue: 20,
        maxUsageCount: 10,
        startsAt,
        endsAt
      }
    });
    expect(dupRes.statusCode).toBe(409);

    // 5. Try invalid discountValue > 100 for PERCENTAGE -> bad request 400
    const invalidValRes = await server.inject({
      method: "POST",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        code: "SAVE200",
        discountType: "PERCENTAGE",
        discountValue: 150,
        startsAt,
        endsAt
      }
    });
    expect(invalidValRes.statusCode).toBe(400);

    // 6. Create discount code for Store B
    const postResB = await server.inject({
      method: "POST",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${tokenB}`
      },
      payload: {
        code: "FLAT50",
        discountType: "FLAT",
        discountValue: 50,
        maxUsageCount: 50,
        startsAt,
        endsAt
      }
    });
    expect(postResB.statusCode).toBe(201);
    const postBodyB = postResB.json();

    // 7. Get discounts for Store A owner -> should return ONLY Store A's code
    const getResA = await server.inject({
      method: "GET",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(getResA.statusCode).toBe(200);
    const getBodyA = getResA.json();
    expect(getBodyA.success).toBe(true);
    expect(getBodyA.data).toHaveLength(1);
    expect(getBodyA.data[0].id).toBe(postBodyA.data.id);
    expect(getBodyA.data[0].code).toBe("SAVE10");

    // 8. Try to deactivate Store B's coupon code using Store A's token -> 403 Forbidden
    const deactivateResForbidden = await server.inject({
      method: "PUT",
      url: `/api/v1/store/discounts/${postBodyB.data.id}/deactivate`,
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });
    expect(deactivateResForbidden.statusCode).toBe(403);

    // 9. Deactivate Store A's coupon code -> 200
    const deactivateResA = await server.inject({
      method: "PUT",
      url: `/api/v1/store/discounts/${postBodyA.data.id}/deactivate`,
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });
    expect(deactivateResA.statusCode).toBe(200);

    // Verify database state is updated
    const updatedDiscount = await db.discount.findUnique({
      where: { id: postBodyA.data.id }
    });
    expect(updatedDiscount?.isActive).toBe(false);

    // 10. Call buyer validation with deactivated discount -> 422 DISCOUNT_INACTIVE
    const validateRes = await server.inject({
      method: "POST",
      url: "/api/v1/promotions/discounts/validate",
      payload: {
        code: "SAVE10",
        subtotal: 500,
        storeId: storeA.id
      }
    });
    expect(validateRes.statusCode).toBe(422);
    expect(validateRes.json().error.code).toBe("DISCOUNT_INACTIVE");

    // 10.5. Update and reactivate the coupon code via PUT -> 200
    const updateRes = await server.inject({
      method: "PUT",
      url: `/api/v1/store/discounts/${postBodyA.data.id}`,
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        code: "save10-new",
        discountType: "PERCENTAGE",
        discountValue: 15,
        maxUsageCount: 200,
        startsAt,
        endsAt,
        isActive: true // reactivate!
      }
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().data.code).toBe("SAVE10-NEW");
    expect(updateRes.json().data.discountValue).toBe("15");
    expect(updateRes.json().data.isActive).toBe(true);

    // 11. Delete discount code -> 200
    const deleteRes = await server.inject({
      method: "DELETE",
      url: `/api/v1/store/discounts/${postBodyA.data.id}`,
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });
    expect(deleteRes.statusCode).toBe(200);

    // Verify discount is fully removed from DB
    const deletedDiscount = await db.discount.findUnique({
      where: { id: postBodyA.data.id }
    });
    expect(deletedDiscount).toBeNull();

    // 12. Create the exact same discount code code after deletion -> should succeed!
    const recreateRes = await server.inject({
      method: "POST",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        code: "save10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        maxUsageCount: 100,
        startsAt,
        endsAt
      }
    });
    expect(recreateRes.statusCode).toBe(201);
    expect(recreateRes.json().data.code).toBe("SAVE10");
  });

  it("should allow different stores to create the same coupon code (tenant-isolated uniqueness)", async () => {
    // 1. Setup Store A & Store B
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Quick Commerce Store A",
      phone: "+919999999901",
      address: "Store A Address",
      storeType: "QUICK_COMMERCE"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Booking Commerce Store B",
      phone: "+919999999902",
      address: "Store B Address",
      storeType: "BOOKING_COMMERCE"
    });

    // 2. Setup Store Owners
    const ownerA = await ownerRepo.create({
      email: "owner.a.unique@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeA.id
    });

    const ownerB = await ownerRepo.create({
      email: "owner.b.unique@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeB.id
    });

    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);
    const tokenB = await generateAccessToken(ownerB.id, "STORE_OWNER", storeB.id);

    const startsAt = new Date(Date.now() + 86400000).toISOString();
    const endsAt = new Date(Date.now() + 86400000 * 5).toISOString();

    // Store A creates code "SAVE20"
    const postResA = await server.inject({
      method: "POST",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        code: "SAVE20",
        discountType: "PERCENTAGE",
        discountValue: 20,
        maxUsageCount: 100,
        startsAt,
        endsAt
      }
    });
    expect(postResA.statusCode).toBe(201);

    // Store B creates the EXACT same code "SAVE20" -> should succeed if tenant-isolated
    const postResB = await server.inject({
      method: "POST",
      url: "/api/v1/store/discounts",
      headers: {
        authorization: `Bearer ${tokenB}`
      },
      payload: {
        code: "SAVE20",
        discountType: "PERCENTAGE",
        discountValue: 20,
        maxUsageCount: 100,
        startsAt,
        endsAt
      }
    });
    expect(postResB.statusCode).toBe(201);
  });
});
