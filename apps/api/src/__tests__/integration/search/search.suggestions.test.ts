import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerSearchRoutes } from "../../../modules/catalog/search.controller.js";
import { createServer } from "../../../server.js";

async function cleanSearchIntegrationGraph(db: PrismaClient): Promise<void> {
  await db.riderLocation.deleteMany().catch(() => {});
  await db.deliveryRider.deleteMany().catch(() => {});
  await db.orderStatusHistory.deleteMany().catch(() => {});
  await db.orderItem.deleteMany().catch(() => {});
  await db.order.deleteMany().catch(() => {});
  await db.cartItem.deleteMany().catch(() => {});
  await db.cart.deleteMany().catch(() => {});
  await db.address.deleteMany().catch(() => {});
  await db.user.deleteMany().catch(() => {});
  await db.stockMovement.deleteMany().catch(() => {});
  await db.productVariant.deleteMany().catch(() => {});
  await db.product.deleteMany().catch(() => {});
  await db.storeOwner.deleteMany().catch(() => {});
  await db.advertisement.deleteMany().catch(() => {});
  await db.offer.deleteMany().catch(() => {});
  await db.discount.deleteMany().catch(() => {});
  await db.store.deleteMany().catch(() => {});
  await db.subCategory.deleteMany().catch(() => {});
  await db.category.deleteMany().catch(() => {});
}

describe("Search suggestions integration", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanSearchIntegrationGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("GET /api/v1/search/suggestions?q=cough returns list of suggestion items", async () => {
    const groceries = await db.category.create({
      data: { slug: "cough-category", name: "Cough Category", imageUrl: "https://example.com/cough.jpg", displayOrder: 1, isActive: true }
    });

    const subcategory = await db.subCategory.create({
      data: { slug: "cough-sub", name: "Cough Subcategory", imageUrl: "https://example.com/cough-sub.jpg", displayOrder: 1, isActive: true, categoryId: groceries.id }
    });

    const qcStore = await db.store.create({
      data: {
        name: "Quick Pharmacy",
        description: "Meds fast",
        phone: "+919999999999",
        address: "Main Road",
        storeType: "QUICK_COMMERCE"
      }
    });

    const bcStore = await db.store.create({
      data: {
        name: "Doctor Consultation Service",
        description: "Book appointments",
        phone: "+918888888888",
        address: "Clinic Road",
        storeType: "BOOKING_COMMERCE"
      }
    });

    const product = await db.product.create({
      data: {
        storeId: qcStore.id,
        categoryId: groceries.id,
        subCategoryId: subcategory.id,
        name: "Cough Syrup",
        description: "Effective syrup",
        imageUrl: "https://example.com/syrup.jpg",
        isActive: true,
        isDeleted: false
      }
    });

    await db.productVariant.create({
      data: { productId: product.id, label: "100ml", price: "50.00", stockQty: 50, unit: "ml", isActive: true }
    });

    const service = await db.product.create({
      data: {
        storeId: bcStore.id,
        categoryId: groceries.id,
        subCategoryId: subcategory.id,
        name: "Cough Checkup Service",
        description: "Consultation for cough",
        imageUrl: "https://example.com/consult.jpg",
        isActive: true,
        isDeleted: false
      }
    });

    await db.productVariant.create({
      data: { productId: service.id, label: "Consultation", price: "500.00", stockQty: 1, unit: "session", isActive: true }
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) => {
        registerSearchRoutes(app);
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/search/suggestions?q=cough"
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        type: "category" | "subcategory" | "product" | "service";
        redirectUrl: string;
      }>;
    };

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.length).toBeGreaterThanOrEqual(4);

    const types = body.data.map(item => item.type);
    expect(types).toContain("category");
    expect(types).toContain("subcategory");
    expect(types).toContain("product");
    expect(types).toContain("service");

    const categoryItem = body.data.find(item => item.type === "category")!;
    expect(categoryItem.redirectUrl).toBe("/categories/cough-category");
    expect(categoryItem.name).toBe("Cough Category");

    const subCategoryItem = body.data.find(item => item.type === "subcategory")!;
    expect(subCategoryItem.redirectUrl).toBe("/categories/cough-category/cough-sub");
    expect(subCategoryItem.name).toBe("Cough Subcategory");

    const productItem = body.data.find(item => item.type === "product")!;
    expect(productItem.redirectUrl).toBe(`/products/${product.id}`);
    expect(productItem.name).toBe("Cough Syrup");

    const serviceItem = body.data.find(item => item.type === "service")!;
    expect(serviceItem.redirectUrl).toBe(`/products/${service.id}`);
    expect(serviceItem.name).toBe("Cough Checkup Service");
  });
});
