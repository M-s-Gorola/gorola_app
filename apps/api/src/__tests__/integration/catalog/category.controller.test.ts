import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerCategoryRoutes } from "../../../modules/catalog/category.controller.js";
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
  await db.subCategory.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.store.deleteMany();
  await db.category.deleteMany();
}

describe("Category controller", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanCatalogIntegrationGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("GET /api/v1/categories returns active categories in envelope", async () => {
    const groceries = await db.category.create({
      data: { slug: "groceries", name: "Groceries", imageUrl: "https://example.com/groceries.jpg", displayOrder: 2, isActive: true }
    });
    const medical = await db.category.create({
      data: { slug: "medical", name: "Medical", imageUrl: "https://example.com/medical.jpg", displayOrder: 1, isActive: true }
    });
    await db.category.create({
      data: { slug: "hidden", name: "Hidden", imageUrl: "https://example.com/hidden.jpg", displayOrder: 0, isActive: false }
    });
    const store = await db.store.create({
      data: {
        name: "Peak Mart",
        description: "Local essentials",
        phone: "+919111111111",
        address: "Mall Road"
      }
    });

    const grocSub = await db.subCategory.create({
      data: { slug: "groc-sub", name: "Groc Sub", categoryId: groceries.id }
    });
    const medSub = await db.subCategory.create({
      data: { slug: "med-sub", name: "Med Sub", categoryId: medical.id }
    });

    await db.product.createMany({
      data: [
        {
          storeId: store.id,
          categoryId: groceries.id,
          subCategoryId: grocSub.id,
          name: "Apple",
          description: "Fresh",
          imageUrl: "https://cdn.example.com/apple.jpg",
          isActive: true,
          isDeleted: false
        },
        {
          storeId: store.id,
          categoryId: groceries.id,
          subCategoryId: grocSub.id,
          name: "Hidden Apple",
          description: "Inactive",
          imageUrl: "https://cdn.example.com/hidden-apple.jpg",
          isActive: false,
          isDeleted: false
        },
        {
          storeId: store.id,
          categoryId: medical.id,
          subCategoryId: medSub.id,
          name: "Deleted Syrup",
          description: "Deleted",
          imageUrl: "https://cdn.example.com/deleted-syrup.jpg",
          isActive: true,
          isDeleted: true
        }
      ]
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) => {
        registerCategoryRoutes(app);
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/categories"
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      success: boolean;
      data: Array<{
        slug: string;
        name: string;
        imageUrl: string | null;
        icon: string | null;
        displayOrder: number;
        isActive: boolean;
        productCount: number;
      }>;
      meta: { requestId: string };
    };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data).toMatchObject([
      {
        slug: "medical",
        name: "Medical",
        imageUrl: "https://example.com/medical.jpg",
        icon: null,
        displayOrder: 1,
        isActive: true,
        productCount: 0
      },
      {
        slug: "groceries",
        name: "Groceries",
        imageUrl: "https://example.com/groceries.jpg",
        icon: null,
        displayOrder: 2,
        isActive: true,
        productCount: 1
      }
    ]);
    expect(body.meta.requestId).toEqual(expect.any(String));
  });
});
