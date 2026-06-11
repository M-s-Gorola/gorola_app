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

describe("StoreOwner Orders Integration Tests", () => {
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

  it("should return 401 Unauthorized when authorization token is missing for getOrders", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/orders"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER rather than STORE_OWNER for getOrders", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/orders",
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should return 200 and paginated orders with strict isolation between stores", async () => {
    // 1. Setup Store A & Store B
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Fast Foods",
      phone: "+919999999902",
      address: "Store B Street"
    });

    // 2. Setup Store Owners
    const ownerA = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeA.id
    });

    await ownerRepo.create({
      email: "owner.b@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeB.id
    });

    // 3. Setup common Buyer User
    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // 4. Create orders for Store A and Store B
    // Order 1 (Store A): PLACED
    const orderA1 = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "PLACED",
        subtotal: 100.0,
        deliveryFee: 10.0,
        total: 110.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park",
        items: {
          create: []
        }
      }
    });

    // Order 2 (Store A): PREPARING
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "PREPARING",
        subtotal: 200.0,
        deliveryFee: 15.0,
        total: 215.0,
        paymentMethod: "UPI",
        landmarkDescription: "Near school"
      }
    });

    // Order 3 (Store B): PLACED
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeB.id,
        status: "PLACED",
        subtotal: 300.0,
        deliveryFee: 20.0,
        total: 320.0,
        paymentMethod: "CARD",
        landmarkDescription: "Near office"
      }
    });

    // 5. Fetch orders for Store Owner A
    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);
    const resA = await server.inject({
      method: "GET",
      url: "/api/v1/store/orders",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(resA.statusCode).toBe(200);
    const bodyA = resA.json();
    expect(bodyA.success).toBe(true);
    expect(bodyA.data).toHaveLength(2); // Only Store A's orders
    expect(bodyA.meta).toMatchObject({
      total: 2,
      page: 1,
      limit: 10,
      hasMore: false
    });

    // Verify properties of mapped order
    const firstOrder = bodyA.data[0];
    expect(firstOrder).toHaveProperty("buyerMaskedPhone");
    expect(firstOrder.buyerMaskedPhone).toBe("*********3210");
    expect(firstOrder).toHaveProperty("items");
    expect(firstOrder).toHaveProperty("statusHistory");

    // 6. Fetch orders for Store Owner A filter by status PLACED
    const resAFilter = await server.inject({
      method: "GET",
      url: "/api/v1/store/orders?status=PLACED",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(resAFilter.statusCode).toBe(200);
    const bodyAFilter = resAFilter.json();
    expect(bodyAFilter.data).toHaveLength(1);
    expect(bodyAFilter.data[0].id).toBe(orderA1.id);

    // 7. Verify Pagination meta hasMore
    const resAPage = await server.inject({
      method: "GET",
      url: "/api/v1/store/orders?page=1&limit=1",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });
    expect(resAPage.statusCode).toBe(200);
    expect(resAPage.json().meta).toMatchObject({
      total: 2,
      page: 1,
      limit: 1,
      hasMore: true
    });
  });

  it("should successfully transition order status and validate state machine rules", async () => {
    const store = await storeRepo.create({
      name: "Store",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store Street"
    });

    const owner = await ownerRepo.create({
      email: "owner@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // Create a PLACED order
    const order = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: store.id,
        status: "PLACED",
        subtotal: 100.0,
        deliveryFee: 10.0,
        total: 110.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park",
        statusHistory: {
          create: {
            status: "PLACED",
            changedBy: "BUYER"
          }
        }
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    // 1. PLACED -> PREPARING (valid)
    const resPrep = await server.inject({
      method: "PUT",
      url: `/api/v1/store/orders/${order.id}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        status: "PREPARING"
      }
    });

    expect(resPrep.statusCode).toBe(200);
    expect(resPrep.json().success).toBe(true);
    expect(resPrep.json().data.status).toBe("PREPARING");

    // Verify DB status history
    const history = await db.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { changedAt: "asc" }
    });
    // First was PLACED (created during order create), second is PREPARING
    expect(history).toHaveLength(2);
    expect(history[1]?.status).toBe("PREPARING");
    expect(history[1]?.changedBy).toBe("STORE_OWNER");

    // 2. PREPARING -> PLACED (invalid backward transition)
    const resInvalid = await server.inject({
      method: "PUT",
      url: `/api/v1/store/orders/${order.id}/status`,
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        status: "PLACED"
      }
    });

    expect(resInvalid.statusCode).toBe(422);
    expect(resInvalid.json().success).toBe(false);
    expect(resInvalid.json().error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("should return 403 Forbidden when store owner attempts to modify other store's order", async () => {
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Organic Groceries",
      phone: "+919999999902",
      address: "Store B Street"
    });

    const ownerA = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeA.id
    });

    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // Create an order for Store B
    const orderB = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeB.id,
        status: "PLACED",
        subtotal: 100.0,
        deliveryFee: 10.0,
        total: 110.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park"
      }
    });

    // Owner A attempts to modify Store B's order
    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);
    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/store/orders/${orderB.id}/status`,
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        status: "PREPARING"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("FORBIDDEN");
  });

  describe("Order filtering by date", () => {
    it("should return correct orders filtered by TODAY and CUSTOM date ranges", async () => {
      const store = await storeRepo.create({
        name: "Date Filter Store",
        description: "Organic Groceries",
        phone: "+919999999908",
        address: "Date Filter Street"
      });

      const owner = await ownerRepo.create({
        email: "owner.date@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });

      const buyer = await db.user.create({
        data: {
          name: "Date Filter Buyer",
          phone: "+919876543208",
          isVerified: true
        }
      });

      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(today.getDate() - 3);

      const createOrderAt = async (createdAt: Date, total: number) => {
        return db.order.create({
          data: {
            userId: buyer.id,
            storeId: store.id,
            status: "PLACED",
            subtotal: total - 10,
            deliveryFee: 10,
            total,
            paymentMethod: "COD",
            landmarkDescription: "Some landmark",
            createdAt
          }
        });
      };

      const orderToday = await createOrderAt(today, 100);
      const orderYesterday = await createOrderAt(yesterday, 200);
      const orderThreeDaysAgo = await createOrderAt(threeDaysAgo, 300);

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      // 1. GET with dateFilter=TODAY -> returns 1 order (today)
      const resToday = await server.inject({
        method: "GET",
        url: "/api/v1/store/orders?dateFilter=TODAY",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(resToday.statusCode).toBe(200);
      expect(resToday.json().data).toHaveLength(1);
      expect(resToday.json().data[0].id).toBe(orderToday.id);

      // 2. GET with dateFilter=CUSTOM from yesterday to today -> returns 2 orders
      const ymd = (d: Date) => d.toISOString().split("T")[0];
      const resCustom = await server.inject({
        method: "GET",
        url: `/api/v1/store/orders?dateFilter=CUSTOM&customFrom=${ymd(yesterday)}&customTo=${ymd(today)}`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(resCustom.statusCode).toBe(200);
      expect(resCustom.json().data).toHaveLength(2);
      const ids = resCustom.json().data.map(({ id }: { id: string }) => id);
      expect(ids).toContain(orderToday.id);
      expect(ids).toContain(orderYesterday.id);
      expect(ids).not.toContain(orderThreeDaysAgo.id);
    });
  });
});
