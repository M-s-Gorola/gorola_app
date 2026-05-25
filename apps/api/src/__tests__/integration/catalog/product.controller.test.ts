import type { PrismaClient, Store } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { registerAppRoutes } from "../../../routes.js";
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

describe("Product controller", () => {
  const db = getPrismaClient();
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  let storeOne: Store;
  let storeTwo: Store;
  let groceriesId: string;
  let medicalId: string;

  beforeEach(async () => {
    await cleanCatalogIntegrationGraph(db);

    storeOne = await db.store.create({
      data: {
        name: "Peak Mart",
        description: "Local essentials",
        phone: "+919111111111",
        address: "Mall Road",
      },
    });
    storeTwo = await db.store.create({
      data: {
        name: "Hill Pharmacy",
        description: "Medicines",
        phone: "+919222222222",
        address: "Library Chowk",
      },
    });

    const groceries = await categoryRepo.create({
      slug: "groceries",
      name: "Groceries",
      imageUrl: "https://example.com/groceries.jpg",
    });
    const medical = await categoryRepo.create({
      slug: "medical",
      name: "Medical",
      imageUrl: "https://example.com/medical.jpg",
    });
    
    const grocSub = await db.subCategory.create({
      data: { slug: "groc-sub", name: "Groc Sub", categoryId: groceries.id }
    });
    const medSub = await db.subCategory.create({
      data: { slug: "med-sub", name: "Med Sub", categoryId: medical.id }
    });
    groceriesId = groceries.id;
    medicalId = medical.id;

    const apple = await productRepo.create({
      storeId: storeOne.id,
      categoryId: groceries.id,
      subCategoryId: grocSub.id,
      name: "Apple",
      description: "Fresh apple",
      imageUrl: "https://cdn.example.com/apple.jpg",
    });
    await db.productVariant.createMany({
      data: [
        { productId: apple.id, label: "500g", price: "120.00", stockQty: 20, unit: "g" },
        { productId: apple.id, label: "1kg", price: "220.00", stockQty: 10, unit: "kg" },
      ],
    });

    const banana = await productRepo.create({
      storeId: storeOne.id,
      categoryId: groceries.id,
      subCategoryId: grocSub.id,
      name: "Banana",
      description: "Ripe banana",
      imageUrl: "https://cdn.example.com/banana.jpg",
    });
    await db.productVariant.create({
      data: { productId: banana.id, label: "1 dozen", price: "90.00", stockQty: 8, unit: "dozen" },
    });

    const coughSyrup = await productRepo.create({
      storeId: storeTwo.id,
      categoryId: medical.id,
      subCategoryId: medSub.id,
      name: "Cough Syrup",
      description: "Relief syrup",
      imageUrl: "https://cdn.example.com/syrup.jpg",
    });
    await db.productVariant.create({
      data: { productId: coughSyrup.id, label: "100ml", price: "180.00", stockQty: 15, unit: "ml" },
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("GET /api/v1/products returns paginated products envelope", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes,
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/products?limit=2",
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            productId: expect.any(String),
            name: expect.any(String),
            storeId: expect.any(String),
            storeName: expect.any(String),
            categoryId: expect.any(String),
            highestPricedVariantId: expect.any(String),
            price: expect.any(String),
            unit: expect.any(String),
          }),
        ]),
        nextCursor: expect.any(String),
      },
      meta: {
        requestId: expect.any(String),
      },
    });
  });

  it("GET /api/v1/products supports categoryId, storeId and search filters", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes,
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/products?categoryId=${groceriesId}&storeId=${storeOne.id}&search=app`,
    });

    await server.close();
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      success: boolean;
      data: { items: Array<{ name: string; categoryId: string; storeId: string }> };
    };
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      name: "Apple",
      categoryId: groceriesId,
      storeId: storeOne.id,
    });
  });

  it("GET /api/v1/products supports cursor pagination", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes,
    });

    const first = await server.inject({
      method: "GET",
      url: "/api/v1/products?limit=2",
    });
    const firstBody = first.json() as {
      data: { items: Array<{ id: string }>; nextCursor: string | null };
    };

    const second = await server.inject({
      method: "GET",
      url: `/api/v1/products?limit=2&cursor=${firstBody.data.nextCursor ?? ""}`,
    });

    await server.close();

    const secondBody = second.json() as {
      data: { items: Array<{ id: string }> };
    };
    expect(second.statusCode).toBe(200);
    expect(secondBody.data.items).toHaveLength(1);
    expect(secondBody.data.items[0]?.id).not.toBe(firstBody.data.items[0]?.id);
    expect(secondBody.data.items[0]?.id).not.toBe(firstBody.data.items[1]?.id);
  });

  it("GET /api/v1/products returns 400 for invalid limit", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes,
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/products?limit=0",
    });

    await server.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: expect.any(String),
        details: expect.any(Object),
      },
      meta: {
        requestId: expect.any(String),
      },
    });
  });

  it("GET /api/v1/products exposes highest active variant price for each product", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes,
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/products?storeId=${storeOne.id}&search=apple`,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: {
        items: Array<{
          name: string;
          highestPricedVariantId: string;
          price: string;
          unit: string;
        }>;
      };
    };
    expect(body.data.items[0]).toMatchObject({
      name: "Apple",
      highestPricedVariantId: expect.any(String),
      price: "220.00",
      unit: "kg",
    });
    expect(medicalId.length).toBeGreaterThan(0);
  });

  it("GET /api/v1/products/:id returns product detail with variants", async () => {
    const apple = await db.product.findFirstOrThrow({
      where: {
        name: "Apple",
      },
    });
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes,
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/products/${apple.id}`,
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: {
        id: apple.id,
        name: "Apple",
        description: "Fresh apple",
        imageUrl: "https://cdn.example.com/apple.jpg",
        store: {
          id: storeOne.id,
          name: "Peak Mart",
          phone: "+919111111111",
          storeType: "QUICK_COMMERCE",
        },
        variants: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            label: expect.any(String),
            price: expect.any(String),
            unit: expect.any(String),
            stockQty: expect.any(Number),
          }),
        ]),
      },
      meta: {
        requestId: expect.any(String),
      },
    });
  });

  it("GET /api/v1/products/:id includes isInStock and isLowStock flags in variants", async () => {
    const apple = await db.product.findFirstOrThrow({ where: { name: "Apple" } });
    const server = createServer({ disableRedis: true, registerRoutes: registerAppRoutes });
    const response = await server.inject({ method: "GET", url: `/api/v1/products/${apple.id}` });
    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const variant = body.data.variants[0];
    expect(variant).toMatchObject({
      isInStock: expect.any(Boolean),
      isLowStock: expect.any(Boolean),
      lowStockThreshold: expect.any(Number)
    });
  });

  it("GET /api/v1/products returns storeType on each item", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes,
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/products?limit=2",
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items[0]).toMatchObject({
      storeType: "QUICK_COMMERCE",
    });
  });

  it("GET /api/v1/products/:id returns 404 when product does not exist", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes,
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/products/non-existent-product-id",
    });

    await server.close();
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: expect.any(String),
        details: expect.any(Object),
      },
      meta: {
        requestId: expect.any(String),
      },
    });
  });
});
