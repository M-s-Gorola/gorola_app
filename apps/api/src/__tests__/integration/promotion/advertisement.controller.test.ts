import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerPromotionRoutes } from "../../../modules/promotion/promotion.controller.js";
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

describe("Advertisement controller", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanPromotionIntegrationGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("GET /api/v1/promotions/advertisements returns active and approved ads in envelope", async () => {
    const store = await db.store.create({
      data: {
        name: "Peak Mart",
        description: "Local essentials",
        phone: "+919111111111",
        address: "Mall Road"
      }
    });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Active and approved
    await db.advertisement.create({
      data: {
        storeId: store.id,
        title: "Active Ad",
        imageUrl: "https://example.com/active.jpg",
        startsAt: yesterday,
        endsAt: tomorrow,
        isActive: true,
        isApproved: true
      }
    });

    // Inactive
    await db.advertisement.create({
      data: {
        storeId: store.id,
        title: "Inactive Ad",
        imageUrl: "https://example.com/inactive.jpg",
        startsAt: yesterday,
        endsAt: tomorrow,
        isActive: false,
        isApproved: true
      }
    });

    // Unapproved
    await db.advertisement.create({
      data: {
        storeId: store.id,
        title: "Unapproved Ad",
        imageUrl: "https://example.com/unapproved.jpg",
        startsAt: yesterday,
        endsAt: tomorrow,
        isActive: true,
        isApproved: false
      }
    });

    // Expired
    await db.advertisement.create({
      data: {
        storeId: store.id,
        title: "Expired Ad",
        imageUrl: "https://example.com/expired.jpg",
        startsAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        endsAt: yesterday,
        isActive: true,
        isApproved: true
      }
    });

    // Future
    await db.advertisement.create({
      data: {
        storeId: store.id,
        title: "Future Ad",
        imageUrl: "https://example.com/future.jpg",
        startsAt: tomorrow,
        endsAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        isActive: true,
        isApproved: true
      }
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) => {
        registerPromotionRoutes(app);
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/promotions/advertisements"
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      success: boolean;
      data: Array<{
        id: string;
        title: string;
        imageUrl: string;
        linkUrl: string | null;
      }>;
      meta: { requestId: string };
    };

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.title).toBe("Active Ad");
  });
});
