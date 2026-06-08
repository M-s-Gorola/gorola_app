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
  await db.auditLog.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.store.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
}

describe("StoreOwner Bulk Restock Integration Tests", () => {
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

  it("should return 401 Unauthorized when authorization token is missing for restock validate", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/bulk/restock/validate",
      payload: { rows: [] }
    });

    expect(response.statusCode).toBe(401);
  });

  it("should return 403 Forbidden when user is a BUYER rather than STORE_OWNER for restock validate", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/bulk/restock/validate",
      headers: {
        authorization: `Bearer ${buyerToken}`
      },
      payload: { rows: [] }
    });

    expect(response.statusCode).toBe(403);
  });

  it("should return 400 Bad Request on empty or invalid validation rows payload", async () => {
    const store = await storeRepo.create({
      name: "QC Store",
      description: "Quick Commerce Store",
      phone: "+919999999901",
      address: "QC Street"
    });
    const owner = await ownerRepo.create({
      email: "owner.qc@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });
    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const responseEmpty = await server.inject({
      method: "POST",
      url: "/api/v1/store/bulk/restock/validate",
      headers: { authorization: `Bearer ${token}` },
      payload: { rows: [] }
    });
    expect(responseEmpty.statusCode).toBe(400);

    const responseInvalid = await server.inject({
      method: "POST",
      url: "/api/v1/store/bulk/restock/validate",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        rows: [
          { productName: "", variantLabel: "500ml", newStockQty: -5 }
        ]
      }
    });
    expect(responseInvalid.statusCode).toBe(400);
  });

  it("should correctly validate stock update rows, detecting missing products, variant mismatch, and ambiguity", async () => {
    // Setup stores
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Organic Groceries",
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
        imageUrl: "http://example.com/dairy.png",
        displayOrder: 1,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        imageUrl: "http://example.com/milk.png",
        displayOrder: 1,
        isActive: true,
        categoryId: category.id
      }
    });

    // Create a product and variant for Store A
    const productA1 = await db.product.create({
      data: {
        name: "Amul Milk",
        description: "Fresh milk",
        storeId: storeA.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    await db.productVariant.create({
      data: {
        productId: productA1.id,
        label: "500ml",
        price: 30,
        stockQty: 50,
        unit: "ml",
        isActive: true
      }
    });

    // Create an AMBIGUOUS duplicate product name in Store A
    await db.product.create({
      data: {
        name: "Duplicate Name",
        description: "Fresh milk",
        storeId: storeA.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });
    await db.product.create({
      data: {
        name: "Duplicate Name",
        description: "Fresh milk duplicate",
        storeId: storeA.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    // Create a product for Store B to verify store isolation (should not find from Store A owner's perspective)
    const productB = await db.product.create({
      data: {
        name: "Store B Milk",
        description: "Fresh milk in B",
        storeId: storeB.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/milk.png",
        isActive: true
      }
    });

    await db.productVariant.create({
      data: {
        productId: productB.id,
        label: "500ml",
        price: 35,
        stockQty: 20,
        unit: "ml",
        isActive: true
      }
    });

    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/bulk/restock/validate",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        rows: [
          { productName: "Amul Milk", variantLabel: "500ml", newStockQty: 100 }, // Valid
          { productName: "Amul Milk", variantLabel: "1L", newStockQty: 200 },    // Variant not found
          { productName: "NonExistent Milk", variantLabel: "500ml", newStockQty: 50 }, // Product not found
          { productName: "Duplicate Name", variantLabel: "500ml", newStockQty: 80 },  // Ambiguous product
          { productName: "Store B Milk", variantLabel: "500ml", newStockQty: 40 }    // Product not found (isolation)
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(false);
    expect(body.data.totalRows).toBe(5);

    const conflicts = body.data.conflicts;
    expect(conflicts).toHaveLength(4);

    expect(conflicts.find((c: { row: number }) => c.row === 2)).toEqual({
      row: 2,
      type: "VARIANT_NOT_FOUND",
      productName: "Amul Milk",
      variantLabel: "1L"
    });

    expect(conflicts.find((c: { row: number }) => c.row === 3)).toEqual({
      row: 3,
      type: "PRODUCT_NOT_FOUND",
      productName: "NonExistent Milk"
    });

    expect(conflicts.find((c: { row: number }) => c.row === 4)).toEqual({
      row: 4,
      type: "AMBIGUOUS_PRODUCT_NAME",
      productName: "Duplicate Name"
    });

    expect(conflicts.find((c: { row: number }) => c.row === 5)).toEqual({
      row: 5,
      type: "PRODUCT_NOT_FOUND",
      productName: "Store B Milk"
    });
  });

  it("should reject confirm on strict mode if conflicts exist", async () => {
    const store = await storeRepo.create({
      name: "QC Store",
      description: "Quick Commerce Store",
      phone: "+919999999901",
      address: "QC Street"
    });
    const owner = await ownerRepo.create({
      email: "owner.qc@gorola.in",
      passwordHash: "dummy-hash",
      storeId: store.id
    });
    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/bulk/restock/confirm?mode=strict",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        rows: [
          { productName: "NonExistent Product", variantLabel: "500ml", newStockQty: 50 }
        ]
      }
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("BULK_CONFLICT");
    expect(body.error.details.conflicts).toHaveLength(1);
  });

  it("should successfully execute skip mode, updating valid items, ignoring conflicting ones, creating stock movements and auditing", async () => {
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
        imageUrl: "http://example.com/dairy.png",
        displayOrder: 1,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        imageUrl: "http://example.com/milk.png",
        displayOrder: 1,
        isActive: true,
        categoryId: category.id
      }
    });

    const product = await db.product.create({
      data: {
        name: "Amul Milk",
        description: "Fresh milk",
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
        price: 30,
        stockQty: 50,
        unit: "ml",
        isActive: true,
        lowStockThreshold: 10
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/bulk/restock/confirm?mode=skip",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        rows: [
          { productName: "Amul Milk", variantLabel: "500ml", newStockQty: 75 }, // Valid, change delta = 25
          { productName: "NonExistent Milk", variantLabel: "500ml", newStockQty: 50 } // Invalid
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(1);
    expect(body.data.skipped).toBe(1);

    // Verify DB variant update
    const dbVariant = await db.productVariant.findUniqueOrThrow({
      where: { id: variant.id }
    });
    expect(dbVariant.stockQty).toBe(75);
    expect(dbVariant.isLowStock).toBe(false);

    // Verify Stock Movement
    const movements = await db.stockMovement.findMany({
      where: { productVariantId: variant.id }
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: "ADJUSTMENT",
      quantity: 25,
      stockQtyBefore: 50,
      stockQtyAfter: 75,
      reason: "Bulk restock update"
    });

    // Verify Audit Log
    const auditLog = await db.auditLog.findFirst({
      where: { action: "STORE_BULK_RESTOCK" }
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.actorId).toBe(owner.id);
    expect(auditLog?.actorRole).toBe("STORE_OWNER");
    expect(auditLog?.newValue).toEqual({
      updatedCount: 1,
      skippedCount: 1
    });
  });

  it("should not create a StockMovement if the new quantity is identical to the old quantity", async () => {
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
        imageUrl: "http://example.com/dairy.png",
        displayOrder: 1,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "milk",
        name: "Milk",
        imageUrl: "http://example.com/milk.png",
        displayOrder: 1,
        isActive: true,
        categoryId: category.id
      }
    });

    const product = await db.product.create({
      data: {
        name: "Amul Milk",
        description: "Fresh milk",
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
        price: 30,
        stockQty: 50,
        unit: "ml",
        isActive: true,
        lowStockThreshold: 10
      }
    });

    const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/store/bulk/restock/confirm?mode=strict",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        rows: [
          { productName: "Amul Milk", variantLabel: "500ml", newStockQty: 50 } // Identical qty
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.updated).toBe(0);

    const movements = await db.stockMovement.findMany({
      where: { productVariantId: variant.id }
    });
    expect(movements).toHaveLength(0);
  });
});
