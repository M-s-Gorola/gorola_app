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
  await db.deliveryRider.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.bookingOrder.deleteMany();
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

describe("Rider Field Technician Route Integration", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let keys: ReturnType<typeof resolveBuyerJwtKeyPair>;
  let storeId1: string;
  let technicianToken: string;
  let deliveryToken: string;
  let categoryId: string;
  let subCategoryId: string;

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

    const store1 = await db.store.create({
      data: {
        name: "Wellness Labs Mussoorie",
        description: "Medical Diagnostics",
        phone: "+919999999991",
        address: "Mussoorie Mall Road",
        storeType: "BOOKING_COMMERCE"
      }
    });
    storeId1 = store1.id;

    // Create Category and SubCategory
    const category = await db.category.create({
      data: {
        slug: "health-tests",
        name: "Health Tests",
        commerceType: "BOOKING_COMMERCE"
      }
    });
    categoryId = category.id;

    const subCategory = await db.subCategory.create({
      data: {
        slug: "blood-tests",
        name: "Blood Tests",
        categoryId: categoryId
      }
    });
    subCategoryId = subCategory.id;

    const passwordHash = await hash("Rider#123", 8);

    const technicianRider = await db.deliveryRider.create({
      data: {
        name: "Tech One",
        phone: "+919000000001",
        email: "tech1@gorola.in",
        passwordHash,
        storeId: storeId1,
        isActive: true,
        riderType: "FIELD_TECHNICIAN"
      }
    });

    const deliveryRider = await db.deliveryRider.create({
      data: {
        name: "Delivery One",
        phone: "+919000000002",
        email: "delivery1@gorola.in",
        passwordHash,
        storeId: storeId1,
        isActive: true,
        riderType: "DELIVERY"
      }
    });

    technicianToken = await new SignJWT({
      role: "RIDER",
      storeId: storeId1
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(technicianRider.id)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);

    deliveryToken = await new SignJWT({
      role: "RIDER",
      storeId: storeId1
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(deliveryRider.id)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);
  });

  it("GET /api/v1/rider/orders/active should return approved booking orders for FIELD_TECHNICIAN and filter them out for DELIVERY riders", async () => {
    const buyer = await db.user.create({
      data: {
        name: "Alice Smith",
        phone: "+919876543211"
      }
    });

    const product = await db.product.create({
      data: {
        storeId: storeId1,
        categoryId: categoryId,
        subCategoryId: subCategoryId,
        name: "Thyroid Panel",
        description: "Complete thyroid checkup",
        imageUrl: "thyroid.jpg"
      }
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Single test",
        price: 800.00,
        stockQty: 999,
        unit: "test",
        requiresFasting: true
      }
    });

    // Create a BOOKING order with status APPROVED
    const bookingOrder = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "APPROVED",
        orderType: "BOOKING",
        subtotal: 800.00,
        deliveryFee: 50.00,
        total: 850.00,
        landmarkDescription: "Near Picture Palace",
        deliveryLat: 30.4598,
        deliveryLng: 78.0664,
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Thyroid Panel",
            variantLabel: "Single test",
            price: 800.00,
            quantity: 1
          }
        },
        bookingOrder: {
          create: {
            scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
            timeslot: "09:00-11:00",
            requiresFasting: true,
            approvalStatus: "APPROVED"
          }
        }
      }
    });

    // Create a QUICK order with status PREPARING to ensure correct categorization
    const quickOrder = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "PREPARING",
        orderType: "QUICK",
        subtotal: 200.00,
        deliveryFee: 30.00,
        total: 230.00,
        landmarkDescription: "Near Library Bazaar",
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Thyroid Panel",
            variantLabel: "Single test",
            price: 200.00,
            quantity: 1
          }
        }
      }
    });

    // 1. Check as FIELD_TECHNICIAN
    const techResponse = await server.inject({
      method: "GET",
      url: "/api/v1/rider/orders/active",
      headers: {
        authorization: `Bearer ${technicianToken}`
      }
    });

    expect(techResponse.statusCode).toBe(200);
    const techBody = techResponse.json();
    expect(techBody.success).toBe(true);
    // Should see only the BOOKING order (APPROVED)
    const techOrders = techBody.data;
    expect(techOrders.length).toBe(1);
    expect(techOrders[0].id).toBe(bookingOrder.id);
    expect(techOrders[0].orderType).toBe("BOOKING");
    expect(techOrders[0].bookingOrder).toBeDefined();
    expect(techOrders[0].bookingOrder.timeslot).toBe("09:00-11:00");
    expect(techOrders[0].bookingOrder.requiresFasting).toBe(true);
    expect(techOrders[0].bookingOrder.scheduledDate).toBeDefined();
    expect(techOrders[0].deliveryAddress.lat).toBe(30.4598);
    expect(techOrders[0].deliveryAddress.lng).toBe(78.0664);

    // 2. Check as DELIVERY rider
    const deliveryResponse = await server.inject({
      method: "GET",
      url: "/api/v1/rider/orders/active",
      headers: {
        authorization: `Bearer ${deliveryToken}`
      }
    });

    expect(deliveryResponse.statusCode).toBe(200);
    const deliveryBody = deliveryResponse.json();
    expect(deliveryBody.success).toBe(true);
    // Should see only the QUICK order (PREPARING)
    const deliveryOrders = deliveryBody.data;
    expect(deliveryOrders.length).toBe(1);
    expect(deliveryOrders[0].id).toBe(quickOrder.id);
    expect(deliveryOrders[0].orderType).toBe("QUICK");
    expect(deliveryOrders[0].bookingOrder).toBeNull();
  });

  it("PUT /api/v1/rider/orders/:id/status should successfully transition BOOKING order states and update booking table in a single transaction", async () => {
    const buyer = await db.user.create({
      data: {
        name: "Alice Smith",
        phone: "+919876543211"
      }
    });

    const product = await db.product.create({
      data: {
        storeId: storeId1,
        categoryId: categoryId,
        subCategoryId: subCategoryId,
        name: "Thyroid Panel",
        description: "Complete thyroid checkup",
        imageUrl: "thyroid.jpg"
      }
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Single test",
        price: 800.00,
        stockQty: 999,
        unit: "test"
      }
    });

    const bookingOrder = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeId1,
        status: "APPROVED",
        orderType: "BOOKING",
        subtotal: 800.00,
        deliveryFee: 50.00,
        total: 850.00,
        landmarkDescription: "Near Picture Palace",
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Thyroid Panel",
            variantLabel: "Single test",
            price: 800.00,
            quantity: 1
          }
        },
        bookingOrder: {
          create: {
            scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            timeslot: "09:00-11:00",
            approvalStatus: "APPROVED"
          }
        }
      }
    });

    // 1. Transition to OUT_FOR_DELIVERY
    const res1 = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${bookingOrder.id}/status`,
      headers: {
        authorization: `Bearer ${technicianToken}`
      },
      body: { status: "OUT_FOR_DELIVERY" }
    });

    expect(res1.statusCode).toBe(200);
    const order1 = await db.order.findUnique({ where: { id: bookingOrder.id } });
    expect(order1?.status).toBe("OUT_FOR_DELIVERY");

    // 2. Transition to DELIVERED
    const res2 = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${bookingOrder.id}/status`,
      headers: {
        authorization: `Bearer ${technicianToken}`
      },
      body: { status: "DELIVERED" }
    });

    expect(res2.statusCode).toBe(200);
    const order2 = await db.order.findUnique({ where: { id: bookingOrder.id } });
    expect(order2?.status).toBe("DELIVERED");

    // Also assert bookingOrder.approvalStatus is COMPLETED
    const bookingRecord = await db.bookingOrder.findUnique({ where: { orderId: bookingOrder.id } });
    expect(bookingRecord?.approvalStatus).toBe("COMPLETED");

    // 3. CANCELLED should throw Forbidden
    const res3 = await server.inject({
      method: "PUT",
      url: `/api/v1/rider/orders/${bookingOrder.id}/status`,
      headers: {
        authorization: `Bearer ${technicianToken}`
      },
      body: { status: "CANCELLED" }
    });

    expect(res3.statusCode).toBe(403);
  });
});
