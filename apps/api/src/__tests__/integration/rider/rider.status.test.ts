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

describe("Rider Order Status Update Integration", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let keys: ReturnType<typeof resolveBuyerJwtKeyPair>;
  let storeId1: string;
  let storeId2: string;
  let categoryId: string;
  let subCategoryId: string;
  let riderTokenStore1: string;
  let variantId1: string;
  let buyerId: string;

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


    riderTokenStore1 = await new SignJWT({
      role: "RIDER",
      storeId: storeId1
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(rider1.id)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);


    const buyer = await db.user.create({
      data: {
        name: "John Doe",
        phone: "+919876543210"
      }
    });
    buyerId = buyer.id;

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
    variantId1 = variant.id;
  });

  it("should return 422 when rider attempts OUT_FOR_DELIVERY transition directly", async () => {
    const order = await db.order.create({
      data: {
        userId: buyerId,
        storeId: storeId1,
        status: "PREPARING",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        items: {
          create: {
            productVariantId: variantId1,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      payload: { status: "OUT_FOR_DELIVERY" },
      headers: {
        authorization: `Bearer ${riderTokenStore1}`
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("should transition OUT_FOR_DELIVERY order to DELIVERED successfully", async () => {
    const rider = await db.deliveryRider.findFirst({ where: { email: "rider1@gorola.in" } });
    const order = await db.order.create({
      data: {
        userId: buyerId,
        storeId: storeId1,
        status: "OUT_FOR_DELIVERY",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        riderId: rider?.id ?? null,
        items: {
          create: {
            productVariantId: variantId1,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      payload: { status: "DELIVERED" },
      headers: {
        authorization: `Bearer ${riderTokenStore1}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("DELIVERED");
  });

  it("should fail transition to PLACED (backward transition forbidden) with 422", async () => {
    const rider = await db.deliveryRider.findFirst({ where: { email: "rider1@gorola.in" } });
    const order = await db.order.create({
      data: {
        userId: buyerId,
        storeId: storeId1,
        status: "OUT_FOR_DELIVERY",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        riderId: rider?.id ?? null,
        items: {
          create: {
            productVariantId: variantId1,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      payload: { status: "PLACED" },
      headers: {
        authorization: `Bearer ${riderTokenStore1}`
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("should reject rider cancellations (CANCELLED) with 403", async () => {
    const rider = await db.deliveryRider.findFirst({ where: { email: "rider1@gorola.in" } });
    const order = await db.order.create({
      data: {
        userId: buyerId,
        storeId: storeId1,
        status: "OUT_FOR_DELIVERY",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        riderId: rider?.id ?? null,
        items: {
          create: {
            productVariantId: variantId1,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      payload: { status: "CANCELLED" },
      headers: {
        authorization: `Bearer ${riderTokenStore1}`
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("should forbid updating an order belonging to a different store", async () => {
    const rider = await db.deliveryRider.findFirst({ where: { email: "rider1@gorola.in" } });
    const order = await db.order.create({
      data: {
        userId: buyerId,
        storeId: storeId2,
        status: "OUT_FOR_DELIVERY",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        riderId: rider?.id ?? null,
        items: {
          create: {
            productVariantId: variantId1,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      payload: { status: "DELIVERED" },
      headers: {
        authorization: `Bearer ${riderTokenStore1}`
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("should save status update with rider:<riderId> prefix in the database status history log", async () => {
    const rider = await db.deliveryRider.findFirst({ where: { email: "rider1@gorola.in" } });
    const order = await db.order.create({
      data: {
        userId: buyerId,
        storeId: storeId1,
        status: "OUT_FOR_DELIVERY",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Central Park",
        riderId: rider?.id ?? null,
        items: {
          create: {
            productVariantId: variantId1,
            productName: "Apple",
            variantLabel: "1kg",
            price: 150.00,
            quantity: 1
          }
        }
      }
    });

    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${order.id}/status`,
      payload: { status: "DELIVERED" },
      headers: {
        authorization: `Bearer ${riderTokenStore1}`
      }
    });

    expect(response.statusCode).toBe(200);

    const history = await db.orderStatusHistory.findFirst({
      where: {
        orderId: order.id,
        status: "DELIVERED"
      }
    });

    expect(history?.changedBy).toBe(`rider:${rider?.id}`);
  });
});
