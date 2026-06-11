import type { PrismaClient } from "@prisma/client";
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

async function cleanRateGraph(db: PrismaClient): Promise<void> {
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
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

describe("PUT /api/v1/orders/:id/rate", () => {
  const db = getPrismaClient();
  let server: ReturnType<typeof createServer>;
  let token: string;
  let user: { id: string };
  let store: { id: string };

  beforeEach(async () => {
    await cleanRateGraph(db);
    process.env.GOROLA_TEST_OTP = "111222";
    server = createServer({ disableRedis: true, registerRoutes: registerAppRoutes });
    const phone = "+919988776657";
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

  it("updates order rating and comment", async () => {
    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: user.id,
        status: "DELIVERED"
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PUT",
      url: `/api/v1/orders/${order.id}/rate`,
      payload: { rating: 4.5, ratingComment: "Great service!" }
    });

    expect(res.statusCode).toBe(200);

    const updated = await db.order.findUnique({ where: { id: order.id } });
    expect(updated?.rating).not.toBeNull();
    expect(Number(updated?.rating)).toBe(4.5);
    expect(updated?.ratingComment).toBe("Great service!");
  });

  it("allows updating rating without a comment", async () => {
    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: user.id,
        status: "DELIVERED"
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PUT",
      url: `/api/v1/orders/${order.id}/rate`,
      payload: { rating: 3.0 }
    });

    expect(res.statusCode).toBe(200);

    const updated = await db.order.findUnique({ where: { id: order.id } });
    expect(updated?.rating).not.toBeNull();
    expect(Number(updated?.rating)).toBe(3.0);
    expect(updated?.ratingComment).toBeNull();
  });

  it("returns 400 if rating is invalid (outside [0, 5])", async () => {
    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: user.id,
        status: "DELIVERED"
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PUT",
      url: `/api/v1/orders/${order.id}/rate`,
      payload: { rating: 5.5 }
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 if order is not DELIVERED", async () => {
    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: user.id,
        status: "OUT_FOR_DELIVERY"
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PUT",
      url: `/api/v1/orders/${order.id}/rate`,
      payload: { rating: 4.0 }
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { message: string } };
    expect(body.error.message).toContain("Only delivered orders can be rated");
  });

  it("returns 404 if order does not belong to user", async () => {
    const otherUser = await db.user.create({ data: { name: "Other", phone: "other-rate" } });
    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: otherUser.id,
        status: "DELIVERED"
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PUT",
      url: `/api/v1/orders/${order.id}/rate`,
      payload: { rating: 4.0 }
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 if order has already been rated", async () => {
    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: user.id,
        status: "DELIVERED",
        rating: 4.0,
        ratingComment: "Already rated"
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PUT",
      url: `/api/v1/orders/${order.id}/rate`,
      payload: { rating: 3.0 }
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { message: string } };
    expect(body.error.message).toContain("Order has already been rated");
  });
});
