import { Prisma, type PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function getBuyerAccessToken(
  server: ReturnType<typeof createServer>,
  phone: string
): Promise<string> {
  await server.inject({ method: "POST", payload: { phone }, url: "/api/v1/auth/buyer/send-otp" });
  const verifyRes = await server.inject({
    method: "POST",
    payload: { otp: "111222", phone },
    url: "/api/v1/auth/buyer/verify-otp"
  });
  return (verifyRes.json() as { data: { accessToken: string } }).data.accessToken;
}

async function cleanOrderHistoryGraph(db: PrismaClient): Promise<void> {
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.bookingOrder.deleteMany().catch(() => {});
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.riderLocation.deleteMany();

  await db.deliveryRider.deleteMany();

  await db.store.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("GET /api/v1/orders/history", () => {
  const db = getPrismaClient();
  let server: ReturnType<typeof createServer>;
  let token: string;
  let user: { id: string };
  let store: { id: string };

  beforeEach(async () => {
    await cleanOrderHistoryGraph(db);
    process.env.GOROLA_TEST_OTP = "111222";
    server = createServer({ disableRedis: true, registerRoutes: registerAppRoutes });
    const phone = "+919988776655";
    token = await getBuyerAccessToken(server, phone);
    user = await db.user.findUniqueOrThrow({ where: { phone } });
    store = await db.store.create({
      data: { address: "Test Addr", description: "Test Desc", name: "Test Store", phone: "123" }
    });
  });

  afterAll(async () => {
    await server?.close();
    delete process.env.GOROLA_TEST_OTP;
    await disconnectPrisma();
  });

  it("returns empty array if user has no orders", async () => {
    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "GET",
      url: "/api/v1/orders/history"
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { orders: Array<{ id: string }> } };
    expect(body.data.orders).toHaveLength(0);
  });

  it("returns user's past orders sorted by createdAt desc", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const order1 = await db.order.create({
      data: {
        deliveryFee: 20,
        landmarkDescription: "lm1",
        storeId: store.id,
        subtotal: 100,
        total: 120,
        userId: user.id,
        status: "DELIVERED",
        createdAt: yesterday
      }
    });

    const order2 = await db.order.create({
      data: {
        deliveryFee: 30,
        landmarkDescription: "lm2",
        storeId: store.id,
        subtotal: 200,
        total: 230,
        userId: user.id,
        status: "PLACED",
        createdAt: new Date()
      }
    });

    // An order for another user should not be returned
    const otherUser = await db.user.create({ data: { name: "Other", phone: "other-hist" } });
    await db.order.create({
      data: {
        deliveryFee: 0,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 0,
        total: 0,
        userId: otherUser.id
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "GET",
      url: "/api/v1/orders/history"
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { orders: Array<{ id: string }> } };
    
    // Should be 2 orders, sorted desc
    expect(body.data.orders).toHaveLength(2);
    expect(body.data.orders[0]?.id).toBe(order2.id); // Newer first
    expect(body.data.orders[1]?.id).toBe(order1.id);
  });

  it("returns user's past bookings with bookingOrder and productId serialization", async () => {
    const category = await db.category.create({
      data: { slug: "booking-cat", name: "Services", imageUrl: "https://example.com/cat.jpg" }
    });
    const subCategory = await db.subCategory.create({
      data: { slug: "booking-sub", name: "Sub Services", categoryId: category.id }
    });
    const bookingStore = await db.store.create({
      data: {
        address: "Test Booking Addr",
        description: "Test Desc",
        name: "Aarna Diagnostic Centre",
        phone: "999",
        storeType: "BOOKING_COMMERCE"
      }
    });
    const product = await db.product.create({
      data: {
        categoryId: category.id,
        subCategoryId: subCategory.id,
        description: "Test product desc",
        imageUrl: "https://example.com/prod.jpg",
        name: "Thyroid (TSH) (Test)",
        storeId: bookingStore.id
      }
    });
    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Thyroid Variant",
        price: new Prisma.Decimal("450"),
        stockQty: 0,
        unit: "visit",
        requiresFasting: false,
        allowedTimeslots: ["12:00-15:00"],
        isActive: true
      }
    });

    const order = await db.order.create({
      data: {
        deliveryFee: 0,
        landmarkDescription: "lm",
        storeId: bookingStore.id,
        subtotal: 450,
        total: 450,
        userId: user.id,
        status: "PLACED",
        orderType: "BOOKING",
        createdAt: new Date(),
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Thyroid (TSH) (Test)",
            variantLabel: "Thyroid Variant",
            price: new Prisma.Decimal("450"),
            quantity: 1
          }
        },
        bookingOrder: {
          create: {
            scheduledDate: new Date("2026-05-28T00:00:00.000Z"),
            timeslot: "12:00-15:00",
            requiresFasting: false,
            approvalStatus: "PENDING_APPROVAL"
          }
        }
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "GET",
      url: "/api/v1/orders/history"
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: {
        orders: Array<{
          id: string;
          orderType: string;
          items: Array<{
            id: string;
            productVariantId: string;
            productId: string;
            productName: string;
          }>;
          bookingOrder: {
            scheduledDate: string;
            timeslot: string;
            requiresFasting: boolean;
            approvalStatus: string;
          } | null;
        }>;
      };
    };

    expect(body.data.orders).toHaveLength(1);
    const firstOrder = body.data.orders[0]!;
    expect(firstOrder.id).toBe(order.id);
    expect(firstOrder.orderType).toBe("BOOKING");
    
    expect(firstOrder.bookingOrder).not.toBeNull();
    expect(firstOrder.bookingOrder?.timeslot).toBe("12:00-15:00");
    expect(firstOrder.bookingOrder?.approvalStatus).toBe("PENDING_APPROVAL");
    expect(firstOrder.bookingOrder?.requiresFasting).toBe(false);
    expect(firstOrder.bookingOrder?.scheduledDate).toContain("2026-05-28");

    expect(firstOrder.items).toHaveLength(1);
    expect(firstOrder.items[0]?.productVariantId).toBe(variant.id);
    expect(firstOrder.items[0]?.productId).toBe(product.id);
  });
});
