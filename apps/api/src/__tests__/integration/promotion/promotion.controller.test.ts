import type { PrismaClient, Store, User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanPromotionIntegrationGraph(db: PrismaClient): Promise<void> {
  await db.riderLocation.deleteMany();
  await db.deliveryRider.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.stockMovement.deleteMany();
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

async function getBuyerAccessToken(
  server: ReturnType<typeof createServer>,
  phone: string
): Promise<{ accessToken: string; userId: string }> {
  const sendRes = await server.inject({
    method: "POST",
    payload: { phone },
    url: "/api/v1/auth/buyer/send-otp"
  });
  expect(sendRes.statusCode).toBe(200);

  const verifyRes = await server.inject({
    method: "POST",
    payload: { otp: "111222", phone },
    url: "/api/v1/auth/buyer/verify-otp"
  });
  expect(verifyRes.statusCode).toBe(200);
  const body = verifyRes.json() as {
    data: { accessToken: string; userId: string };
  };
  return { accessToken: body.data.accessToken, userId: body.data.userId };
}

describe("Promotion controller offers auth", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);

  let user: User;
  let store: Store;

  beforeEach(async () => {
    await cleanPromotionIntegrationGraph(db);
    user = await userRepo.create({ phone: "+919700000001", name: "Promotion Controller User" });
    store = await storeRepo.create({
      name: "Promotion Store",
      description: "d",
      phone: "+911111111199",
      address: "Road"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("returns HTTP 401 UNAUTHORIZED when no token is provided", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/promotions/store/${store.id}/offers`
    });

    expect(res.statusCode).toBe(401);
    await server.close();
  });

  it("returns HTTP 200 and serializes offers correctly when a valid token is provided", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, user.phone);

    const now = new Date();
    const seededOffer = await db.offer.create({
      data: {
        storeId: store.id,
        title: "Buy 1 Get 1",
        description: "Bogo offer",
        discountType: "PERCENTAGE",
        discountValue: "50.00",
        minOrderAmount: "200.00",
        maxDiscount: "100.00",
        startsAt: new Date(now.getTime() - 60000),
        endsAt: new Date(now.getTime() + 60000),
        isActive: true
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: `/api/v1/promotions/store/${store.id}/offers`
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      success: boolean;
      data: Array<{
        id: string;
        title: string;
        discountType: string;
        discountValue: number;
        minOrderAmount: number | null;
        maxDiscount: number | null;
        startsAt: string;
        endsAt: string;
        isActive: boolean;
      }>;
    };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual({
      id: seededOffer.id,
      title: "Buy 1 Get 1",
      discountType: "PERCENTAGE",
      discountValue: 50,
      minOrderAmount: 200,
      maxDiscount: 100,
      startsAt: seededOffer.startsAt.toISOString(),
      endsAt: seededOffer.endsAt.toISOString(),
      isActive: true
    });

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("returns HTTP 200 with an empty list when store has no offers", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, user.phone);

    const res = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: `/api/v1/promotions/store/${store.id}/offers`
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      success: boolean;
      data: unknown[];
    };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });
});
