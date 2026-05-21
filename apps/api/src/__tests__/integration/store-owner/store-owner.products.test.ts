import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { StoreOwnerRepository } from "../../../modules/store-owner/store-owner.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function generateAccessToken(userId: string, role: string, storeId?: string): Promise<string> {
  const keys = resolveBuyerJwtKeyPair();
  return new SignJWT({
    role,
    ...(storeId ? { storeId } : {})
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keys.privateKey);
}

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.bookingOrder.deleteMany();
  await db.stockMovement.deleteMany();
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

describe("StoreOwner Products Integration Tests", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const ownerRepo = new StoreOwnerRepository(db);
  let server: FastifyInstance;

  beforeAll(() => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);
  });

  it("should return 401 Unauthorized when authorization token is missing for getProducts", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/products"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER rather than STORE_OWNER for getProducts", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/products",
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should return 200 and products with strict isolation between stores", async () => {
    // Setup stores
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Fast Foods",
      phone: "+919999999902",
      address: "Store B Street"
    });

    // Setup Store Owners
    const ownerA = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeA.id
    });

    // Setup category & subcategory
    const category = await db.category.create({
      data: {
        slug: "groceries",
        name: "Groceries",
        imageUrl: "http://example.com/groceries.png",
        displayOrder: 1,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "fruits",
        name: "Fruits",
        imageUrl: "http://example.com/fruits.png",
        displayOrder: 1,
        isActive: true,
        categoryId: category.id
      }
    });

    // Create a product for Store A
    const productA = await db.product.create({
      data: {
        name: "Store A Apple",
        description: "Fresh apples",
        storeId: storeA.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/apple.png",
        isActive: true
      }
    });

    // Create a product for Store B
    await db.product.create({
      data: {
        name: "Store B Banana",
        description: "Fresh bananas",
        storeId: storeB.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/banana.png",
        isActive: true
      }
    });

    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/products",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Store A Apple");
  });

  it("should successfully create a product with variants and initial stock movement", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: {
        slug: "dairy",
        name: "Dairy",
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        isActive: true,
        categoryId: category.id
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const payload = {
      name: "Fresh Milk",
      subCategoryId: subCategory.id,
      description: "Pure dairy milk",
      imageUrl: "http://example.com/milk.png",
      variants: [
        { label: "500ml", price: 35, stockQty: 100, unit: "packet" },
        { label: "1L", price: 65, stockQty: 50, unit: "bottle" }
      ]
    };

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/products",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Fresh Milk");
    expect(body.data.variants).toHaveLength(2);

    // Verify variants created in DB
    const variantsInDb = await db.productVariant.findMany({
      where: { productId: body.data.id },
      orderBy: { label: "asc" }
    });
    expect(variantsInDb).toHaveLength(2);
    expect(variantsInDb[0]?.label).toBe("1L");
    expect(variantsInDb[0]?.price.toString()).toBe("65");
    expect(variantsInDb[0]?.stockQty).toBe(50);
    expect(variantsInDb[0]?.isInStock).toBe(true);

    // Verify StockMovements with type INITIAL created
    const movements = await db.stockMovement.findMany({
      where: { productVariantId: { in: variantsInDb.map((v) => v.id) } }
    });
    expect(movements).toHaveLength(2);
    expect(movements[0]?.type).toBe("INITIAL");
    expect(movements[0]?.quantity).toBe(movements[0]?.stockQtyAfter);
  });

  it("should throw 409 Conflict when attempting to create duplicate variant labels", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: {
        slug: "dairy",
        name: "Dairy",
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        isActive: true,
        categoryId: category.id
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const payload = {
      name: "Fresh Milk",
      subCategoryId: subCategory.id,
      description: "Pure dairy milk",
      imageUrl: "http://example.com/milk.png",
      variants: [
        { label: "500ml", price: 35, stockQty: 100, unit: "packet" },
        { label: "500ml", price: 35, stockQty: 50, unit: "packet" }
      ]
    };

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/products",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("CONFLICT");
  });

  it("should throw 404 Not Found when creating with a non-existent subCategoryId", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const payload = {
      name: "Fresh Milk",
      subCategoryId: "non-existent-id",
      description: "Pure dairy milk",
      imageUrl: "http://example.com/milk.png",
      variants: [
        { label: "500ml", price: 35, stockQty: 100, unit: "packet" }
      ]
    };

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/products",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });

  it("should successfully update a product's name and details", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: {
        slug: "dairy",
        name: "Dairy",
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        isActive: true,
        categoryId: category.id
      }
    });

    const product = await db.product.create({
      data: {
        name: "Original Milk",
        description: "Pure dairy milk",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/store/products/${product.id}`,
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: "Super Milk",
        description: "Even better milk"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Super Milk");
    expect(body.data.description).toBe("Even better milk");

    // Verify DB
    const updatedProduct = await db.product.findUnique({
      where: { id: product.id }
    });
    expect(updatedProduct?.name).toBe("Super Milk");
  });

  it("should return 403 Forbidden when attempting to update another store's product", async () => {
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Fast Foods",
      phone: "+919999999902",
      address: "Store B Street"
    });

    const ownerA = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeA.id
    });

    const category = await db.category.create({
      data: {
        slug: "dairy",
        name: "Dairy",
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        isActive: true,
        categoryId: category.id
      }
    });

    // Create a product for Store B
    const productB = await db.product.create({
      data: {
        name: "Store B Milk",
        description: "B Milk",
        storeId: storeB.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    // Owner A attempts to modify Store B's product
    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);
    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/store/products/${productB.id}`,
      headers: {
        authorization: `Bearer ${tokenA}`
      },
      payload: {
        name: "Hacked Milk"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should successfully soft delete a product", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: {
        slug: "dairy",
        name: "Dairy",
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        isActive: true,
        categoryId: category.id
      }
    });

    const product = await db.product.create({
      data: {
        name: "Original Milk",
        description: "Pure dairy milk",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const response = await server.inject({
      method: "DELETE",
      url: `/api/v1/store/products/${product.id}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);

    // Verify DB
    const dbProduct = await db.product.findUnique({
      where: { id: product.id }
    });
    expect(dbProduct?.isDeleted).toBe(true);
  });

  it("should successfully update variant price and stock, and record ADJUSTMENT StockMovement", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: {
        slug: "dairy",
        name: "Dairy",
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        isActive: true,
        categoryId: category.id
      }
    });

    const product = await db.product.create({
      data: {
        name: "Original Milk",
        description: "Pure dairy milk",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "500ml",
        price: 35.0,
        stockQty: 10,
        lowStockThreshold: 5,
        isLowStock: false,
        isInStock: true,
        unit: "packet",
        isActive: true
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/store/products/${product.id}/variants/${variant.id}`,
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        price: 40,
        stockQty: 25,
        lowStockThreshold: 10
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.price.toString()).toBe("40");
    expect(body.data.stockQty).toBe(25);
    expect(body.data.lowStockThreshold).toBe(10);
    expect(body.data.isLowStock).toBe(false);

    // Verify DB variant
    const dbVariant = await db.productVariant.findUniqueOrThrow({
      where: { id: variant.id }
    });
    expect(dbVariant.price.toString()).toBe("40");
    expect(dbVariant.stockQty).toBe(25);

    // Verify StockMovement recorded
    const movements = await db.stockMovement.findMany({
      where: { productVariantId: variant.id },
      orderBy: { createdAt: "desc" }
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("ADJUSTMENT");
    expect(movements[0]?.stockQtyBefore).toBe(10);
    expect(movements[0]?.stockQtyAfter).toBe(25);
    expect(movements[0]?.quantity).toBe(15);
  });

  it("should successfully fetch a single product by id", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: {
        slug: "dairy",
        name: "Dairy",
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        isActive: true,
        categoryId: category.id
      }
    });

    const product = await db.product.create({
      data: {
        name: "Single Product",
        description: "Pure dairy milk",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const response = await server.inject({
      method: "GET",
      url: `/api/v1/store/products/${product.id}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Single Product");
  });

  it("should successfully update variant isActive status to false (soft-deactivate)", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: { slug: "dairy", name: "Dairy", isActive: true }
    });

    const subCategory = await db.subCategory.create({
      data: { slug: "milk", name: "Milk", isActive: true, categoryId: category.id }
    });

    const product = await db.product.create({
      data: {
        name: "Toggle Variant Product",
        description: "Desc",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Deactivatable Size",
        price: 10,
        stockQty: 10,
        lowStockThreshold: 5,
        isLowStock: false,
        isInStock: true,
        unit: "packet",
        isActive: true
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const response = await server.inject({
      method: "PUT",
      url: `/api/v1/store/products/${product.id}/variants/${variant.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: false }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.isActive).toBe(false);

    // Verify database
    const dbVariant = await db.productVariant.findUniqueOrThrow({
      where: { id: variant.id }
    });
    expect(dbVariant.isActive).toBe(false);
  });

  it("should successfully add a new variant to an existing product and register an INITIAL stock movement", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: { slug: "dairy", name: "Dairy", isActive: true }
    });

    const subCategory = await db.subCategory.create({
      data: { slug: "milk", name: "Milk", isActive: true, categoryId: category.id }
    });

    const product = await db.product.create({
      data: {
        name: "Product For New Variant",
        description: "Desc",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const response = await server.inject({
      method: "POST",
      url: `/api/v1/store/products/${product.id}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: "Dynamic Variant",
        price: 49.99,
        stockQty: 80,
        unit: "kg",
        lowStockThreshold: 10
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.label).toBe("Dynamic Variant");
    expect(body.data.price.toString()).toBe("49.99");
    expect(body.data.stockQty).toBe(80);
    expect(body.data.lowStockThreshold).toBe(10);
    expect(body.data.isActive).toBe(true);

    // Verify database variant exists
    const dbVariant = await db.productVariant.findUniqueOrThrow({
      where: { id: body.data.id }
    });
    expect(dbVariant.productId).toBe(product.id);

    // Verify stock movement
    const movements = await db.stockMovement.findMany({
      where: { productVariantId: dbVariant.id }
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("INITIAL");
    expect(movements[0]?.quantity).toBe(80);
  });

  it("should throw 409 Conflict when adding a variant with a duplicate label (active or inactive)", async () => {
    const store = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const owner = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });

    const category = await db.category.create({
      data: { slug: "dairy", name: "Dairy", isActive: true }
    });

    const subCategory = await db.subCategory.create({
      data: { slug: "milk", name: "Milk", isActive: true, categoryId: category.id }
    });

    const product = await db.product.create({
      data: {
        name: "Duplicate Label Product",
        description: "Desc",
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    // Create an existing variant (active or inactive)
    await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Unique Size",
        price: 15,
        stockQty: 10,
        unit: "packet",
        isActive: false // inactive variant should still block duplicate labels!
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    const response = await server.inject({
      method: "POST",
      url: `/api/v1/store/products/${product.id}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: "unique size ", // testing trimming and case-insensitive check
        price: 20,
        stockQty: 30,
        unit: "packet"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("CONFLICT");
  });
});

