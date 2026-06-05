import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerSearchRoutes } from "../../../modules/catalog/search.controller.js";
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

describe("Search controller", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanCatalogIntegrationGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("GET /api/v1/search?q= queries categories, subcategories, and products", async () => {
    const groceries = await db.category.create({
      data: { slug: "groceries", name: "Groceries", imageUrl: "https://example.com/groceries.jpg", displayOrder: 2, isActive: true }
    });

    const subGrocSnacks = await db.subCategory.create({
      data: { slug: "snacks", name: "Snacks", imageUrl: "https://example.com/snacks.jpg", displayOrder: 2, isActive: true, categoryId: groceries.id }
    });
    
    const store = await db.store.create({
      data: {
        name: "Peak Mart",
        description: "Local essentials",
        phone: "+919111111111",
        address: "Mall Road"
      }
    });

    const apple = await db.product.create({
      data: {
        storeId: store.id,
        categoryId: groceries.id,
        subCategoryId: subGrocSnacks.id,
        name: "Apple Snacks",
        description: "Fresh apple snacks",
        imageUrl: "https://cdn.example.com/apple.jpg",
        isActive: true,
        isDeleted: false
      }
    });

    await db.productVariant.create({
      data: { productId: apple.id, label: "500g", price: "120.00", stockQty: 20, unit: "g", isActive: true }
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) => {
        registerSearchRoutes(app);
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/search?q=snack"
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      success: boolean;
      data: {
        categories: Array<{ id: string; name: string; slug: string; imageUrl: string | null }>;
        subCategories: Array<{ id: string; name: string; slug: string; imageUrl: string | null }>;
        products: Array<{ id: string; name: string; imageUrl: string; price: string; unit: string }>;
      };
      meta: { requestId: string };
    };
    
    expect(body.success).toBe(true);
    expect(body.data.categories).toHaveLength(0); // "snack" doesn't match "Groceries"
    expect(body.data.subCategories).toHaveLength(1); // Matches "Snacks"
    expect(body.data.products).toHaveLength(1); // Matches "Apple Snacks"
    
    expect(body.data.subCategories[0]).toMatchObject({ 
      name: "Snacks",
      categorySlug: "groceries"
    });
    expect(body.data.products[0]).toMatchObject({ name: "Apple Snacks", price: "120.00", unit: "g" });
  });

  it("GET /api/v1/search requires q parameter", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) => registerSearchRoutes(app)
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/search"
    });

    await server.close();
    expect(response.statusCode).toBe(400);
  });
});
