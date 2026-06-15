import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
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
  await db.admin.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
}

describe("RiderOrders Route Integration", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let keys: ReturnType<typeof resolveBuyerJwtKeyPair>;
  let storeId1: string;
  let storeId2: string;
  let categoryId: string;
  let subCategoryId: string;
  let riderTokenStore1: string;
  let riderTokenStore2: string;
  let buyerToken: string;

  beforeAll(async () => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    await server.ready();
    keys = resolveBuyerJwtKeyPair();
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);

    // 1. Create two stores
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

    // Create Category and SubCategory
    const category = await db.category.create({
      data: {
        slug: "fruits",
        name: "Fruits",
        commerceType: "QUICK_COMMERCE"
      }
    });
    categoryId = category.id;

    const subCategory = await db.subCategory.create({
      data: {
        slug: "fresh-fruits",
        name: "Fresh Fruits",
        categoryId: categoryId
      }
    });
    subCategoryId = subCategory.id;

    // 2. Create and hash password for riders
    const passwordHash = await hash("Rider#123", 8);

    const rider1 = await db.deliveryRider.create({
      data: {
        name: "Rider One",
        phone: "+919000000001",
        email: "rider1@gorola.in",
        passwordHash,
        isActive: true
      }
    });

    await db.riderStore.create({
      data: {
        riderId: rider1.id,
        storeId: storeId1,
        isPrimary: true
      }
    });

    const rider2 = await db.deliveryRider.create({
      data: {
        name: "Rider Two",
        phone: "+919000000002",
        email: "rider2@gorola.in",
        passwordHash,
        isActive: true
      }
    });

    await db.riderStore.create({
      data: {
        riderId: rider2.id,
        storeId: storeId2,
        isPrimary: true
      }
    });

    // 3. Create tokens
    riderTokenStore1 = await new SignJWT({
      role: "RIDER",
      storeId: storeId1
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(rider1.id)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);

    riderTokenStore2 = await new SignJWT({
      role: "RIDER",
      storeId: storeId2
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(rider2.id)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);

    buyerToken = await new SignJWT({
      role: "BUYER"
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("test-buyer-id")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);
  });

  it("GET /api/v1/rider/orders/active should filter by status and return correct schema", async () => {
    // 1. Create a buyer user
    const buyer = await db.user.create({
      data: {
        name: "John Doe",
        phone: "+919876543210"
      }
    });

    // 2. Create products and variants for store1
    const product = await db.product.create({
      data: {
        storeId: storeId1,
        categoryId: categoryId,
        subCategoryId: subCategoryId,
        name: "Apple",
        description: "Fresh apples",
        imageUrl: "apples.jpg"
      }
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "1kg",
        price: 150.00,
        stockQty: 50,
        unit: "kg"
      }
    });

    // 3. Create 3 orders for store1: PLACED, PREPARING, OUT_FOR_DELIVERY
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PLACED",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    const orderPreparing = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "OUT_FOR_DELIVERY",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    // 4. Hit endpoint with riderTokenStore1
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/rider/orders/active",
      headers: {
        authorization: `Bearer ${riderTokenStore1}`
      }
    });

    // We expect this to fail initially with 501 in RED phase.
    // Once implemented, it should return HTTP 200 with the 2 active orders.
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.length).toBe(2);

    // Verify status filtering
    const statuses = body.data.map((o: { status: string }) => o.status);
    expect(statuses).toContain("PREPARING");
    expect(statuses).toContain("OUT_FOR_DELIVERY");
    expect(statuses).not.toContain("PLACED");

    // Verify payload schema
    const activeOrder = body.data.find((o: { id: string }) => o.id === orderPreparing.id);
    expect(activeOrder).toBeDefined();
    expect(activeOrder.status).toBe("PREPARING");
    expect(activeOrder.buyerMaskedPhone).toBe("*********3210");
    expect(activeOrder.deliveryAddress.landmark).toBe("Near Central Park");
    expect(activeOrder.items.length).toBe(1);
    expect(activeOrder.items[0].productName).toBe("Apple");
    expect(activeOrder.items[0].variantLabel).toBe("1kg");
    expect(activeOrder.items[0].quantity).toBe(1);
    expect(activeOrder.createdAt).toBeDefined();
  });

  it("GET /api/v1/rider/orders/active should reject buyer role (403)", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/rider/orders/active",
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("GET /api/v1/rider/orders/active should reject missing authorization (401)", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/rider/orders/active"
    });

    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/rider/orders/active should scope results strictly to the rider's store", async () => {
    // 1. Create a buyer user
    const buyer = await db.user.create({
      data: {
        name: "John Doe",
        phone: "+919876543210"
      }
    });

    // 2. Create products and variants for store1
    const product = await db.product.create({
      data: {
        storeId: storeId1,
        categoryId: categoryId,
        subCategoryId: subCategoryId,
        name: "Apple",
        description: "Fresh apples",
        imageUrl: "apples.jpg"
      }
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "1kg",
        price: 150.00,
        stockQty: 50,
        unit: "kg"
      }
    });

    // 3. Create PREPARING order in store1
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    // 4. Hit endpoint with riderTokenStore2 (for store2)
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/rider/orders/active",
      headers: {
        authorization: `Bearer ${riderTokenStore2}`
      }
    });

    // It should succeed with 200 but return 0 orders since there are no active orders in store2
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(0);
  });
});
