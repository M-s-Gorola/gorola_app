import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerSubCategoryRoutes } from "../../../modules/catalog/sub-category.controller.js";
import { createServer } from "../../../server.js";

async function cleanCatalogIntegrationGraph(db: PrismaClient): Promise<void> {
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

describe("SubCategory controller", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanCatalogIntegrationGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("GET /api/v1/categories/:slug/sub-categories returns active sub-categories", async () => {
    const groceries = await db.category.create({
      data: { slug: "groceries", name: "Groceries", imageUrl: "https://example.com/groceries.jpg", displayOrder: 2, isActive: true }
    });

    await db.subCategory.create({
      data: { slug: "snacks", name: "Snacks", imageUrl: "https://example.com/snacks.jpg", displayOrder: 2, isActive: true, categoryId: groceries.id }
    });
    
    await db.subCategory.create({
      data: { slug: "beverages", name: "Beverages", imageUrl: "https://example.com/bev.jpg", displayOrder: 1, isActive: true, categoryId: groceries.id }
    });

    await db.subCategory.create({
      data: { slug: "hidden", name: "Hidden", imageUrl: "https://example.com/hidden.jpg", displayOrder: 0, isActive: false, categoryId: groceries.id }
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) => {
        registerSubCategoryRoutes(app);
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/categories/groceries/sub-categories"
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      success: boolean;
      data: Array<{
        slug: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
      }>;
      meta: { requestId: string };
    };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data).toMatchObject([
      {
        slug: "beverages",
        name: "Beverages",
        imageUrl: "https://example.com/bev.jpg",
        displayOrder: 1,
        isActive: true,
      },
      {
        slug: "snacks",
        name: "Snacks",
        imageUrl: "https://example.com/snacks.jpg",
        displayOrder: 2,
        isActive: true,
      }
    ]);
    expect(body.meta.requestId).toEqual(expect.any(String));
  });
});
