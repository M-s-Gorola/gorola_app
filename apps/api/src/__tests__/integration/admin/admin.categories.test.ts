import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function generateAccessToken(userId: string, role: string): Promise<string> {
  const keys = resolveBuyerJwtKeyPair();
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keys.privateKey);
}

describe("Admin Categories API Integration Tests", () => {
  let server: FastifyInstance;
  const db = getPrismaClient();
  let adminToken: string;

  beforeAll(async () => {
    server = await createServer();
    registerAppRoutes(server);
    adminToken = await generateAccessToken("admin-123", "ADMIN");
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await db.cartItem.deleteMany();
    await db.cart.deleteMany();
    await db.orderItem.deleteMany();
    await db.order.deleteMany();
    await db.address.deleteMany();
    await db.user.deleteMany();
    await db.stockMovement.deleteMany();
    await db.productVariant.deleteMany();
    await db.product.deleteMany();
    await db.storeOwner.deleteMany();
    await db.advertisement.deleteMany();
    await db.offer.deleteMany();
    await db.discount.deleteMany();
    await db.riderLocation.deleteMany();

    await db.deliveryRider.deleteMany();

    await db.store.deleteMany();
    await db.subCategory.deleteMany();
    await db.category.deleteMany();
    await db.auditLog.deleteMany();
  });

  it("should enforce ADMIN role authorization", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${buyerToken}` }
    });
    expect(res.statusCode).toBe(403);
  });

  it("should create new category with commerceType and audit log", async () => {
    const payload = {
      name: "Fresh Fruits",
      slug: "fresh-fruits",
      imageUrl: "https://example.com/fruits.jpg",
      displayOrder: 1,
      commerceType: "QUICK_COMMERCE"
    };

    const res = await server.inject({
      method: "POST",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.name).toBe("Fresh Fruits");
    expect(body.data.commerceType).toBe("QUICK_COMMERCE");

    // Verify DB
    const dbCat = await db.category.findUnique({
      where: { id: body.data.id }
    });
    expect(dbCat).toBeDefined();
    expect(dbCat?.commerceType).toBe("QUICK_COMMERCE");

    // Verify AuditLog
    const logs = await db.auditLog.findMany({
      where: { entityId: body.data.id, action: "ADMIN_CATEGORY_CREATE" }
    });
    expect(logs.length).toBe(1);
    expect(logs[0]?.actorId).toBe("admin-123");
  });

  it("should prevent creating category with duplicate slug", async () => {
    await db.category.create({
      data: { name: "Fruits", slug: "fruits", commerceType: "QUICK_COMMERCE" }
    });

    const res = await server.inject({
      method: "POST",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "More Fruits",
        slug: "fruits",
        commerceType: "QUICK_COMMERCE"
      }
    });

    expect(res.statusCode).toBe(409);
  });

  it("should fetch all categories with nested subcategories and product counts", async () => {
    const store = await db.store.create({
      data: { name: "Mart", description: "D", phone: "+1", address: "A", storeType: "QUICK_COMMERCE" }
    });
    const c1 = await db.category.create({
      data: { name: "Dairy", slug: "dairy", commerceType: "QUICK_COMMERCE", displayOrder: 2 }
    });
    await db.category.create({
      data: { name: "Bakery", slug: "bakery", commerceType: "QUICK_COMMERCE", displayOrder: 1 }
    });
    const sc = await db.subCategory.create({
      data: { name: "Milk", slug: "milk", categoryId: c1.id }
    });

    // Seed a product in subcategory to verify productCount
    await db.product.create({
      data: {
        name: "Organic Milk",
        description: "Fresh",
        imageUrl: "http://milk.jpg",
        storeId: store.id,
        categoryId: c1.id,
        subCategoryId: sc.id
      }
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(2);
    // Order should be displayOrder: Bakery (1) first, Dairy (2) second
    expect(body.data[0].slug).toBe("bakery");
    expect(body.data[1].slug).toBe("dairy");
    expect(body.data[1].productCount).toBe(1);
    expect(body.data[1].subCategories.length).toBe(1);
    expect(body.data[1].subCategories[0].productCount).toBe(1);
  });

  it("should update category attributes and status", async () => {
    const category = await db.category.create({
      data: { name: "Clean", slug: "clean", commerceType: "QUICK_COMMERCE" }
    });

    const res = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/categories/${category.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Cleaning Products",
        isActive: false
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.name).toBe("Cleaning Products");
    expect(body.data.isActive).toBe(false);

    // Verify DB
    const dbCat = await db.category.findUnique({ where: { id: category.id } });
    expect(dbCat?.isActive).toBe(false);

    // Verify AuditLog
    const logs = await db.auditLog.findMany({
      where: { entityId: category.id, action: "ADMIN_CATEGORY_UPDATE" }
    });
    expect(logs.length).toBe(1);
    expect(logs[0]?.newValue).toEqual(expect.objectContaining({ isActive: false, name: "Cleaning Products" }));
  });

  it("should fail to delete category with associated products, otherwise succeed", async () => {
    const store = await db.store.create({
      data: { name: "Mart", description: "D", phone: "+1", address: "A", storeType: "QUICK_COMMERCE" }
    });
    const c1 = await db.category.create({
      data: { name: "Dairy", slug: "dairy", commerceType: "QUICK_COMMERCE" }
    });
    const sc = await db.subCategory.create({
      data: { name: "Milk", slug: "milk", categoryId: c1.id }
    });
    await db.product.create({
      data: { name: "Milk packet", description: "Fresh", imageUrl: "m.jpg", storeId: store.id, categoryId: c1.id, subCategoryId: sc.id }
    });

    // 1. Delete category with products -> 409
    const resFail = await server.inject({
      method: "DELETE",
      url: `/api/v1/admin/categories/${c1.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(resFail.statusCode).toBe(409);

    // 2. Delete product first, then delete category -> 200
    await db.product.deleteMany();
    const resOk = await server.inject({
      method: "DELETE",
      url: `/api/v1/admin/categories/${c1.id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(resOk.statusCode).toBe(200);

    // Verify DB deleted
    const dbCat = await db.category.findUnique({ where: { id: c1.id } });
    expect(dbCat).toBeNull();
    const dbSub = await db.subCategory.findFirst({ where: { categoryId: c1.id } });
    expect(dbSub).toBeNull();
  });

  it("should reorder category displayOrder", async () => {
    const c1 = await db.category.create({
      data: { name: "A", slug: "a", displayOrder: 1 }
    });
    const c2 = await db.category.create({
      data: { name: "B", slug: "b", displayOrder: 2 }
    });

    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/admin/categories/reorder",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: [
        { id: c1.id, displayOrder: 10 },
        { id: c2.id, displayOrder: 5 }
      ]
    });

    expect(res.statusCode).toBe(200);

    const dbC1 = await db.category.findUnique({ where: { id: c1.id } });
    const dbC2 = await db.category.findUnique({ where: { id: c2.id } });
    expect(dbC1?.displayOrder).toBe(10);
    expect(dbC2?.displayOrder).toBe(5);
  });

  it("should create, update, and reorder subcategories under categories", async () => {
    const category = await db.category.create({
      data: { name: "Pantry", slug: "pantry", commerceType: "QUICK_COMMERCE" }
    });

    // 1. Create subcategory under /categories/:slug/sub-categories
    const resCreate = await server.inject({
      method: "POST",
      url: `/api/v1/admin/categories/${category.slug}/sub-categories`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Spices",
        slug: "spices",
        displayOrder: 1
      }
    });

    expect(resCreate.statusCode).toBe(201);
    const bodyCreate = resCreate.json();
    expect(bodyCreate.data.id).toBeDefined();
    expect(bodyCreate.data.name).toBe("Spices");
    expect(bodyCreate.data.categoryId).toBe(category.id);

    // 2. Update subcategory
    const resUpdate = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/sub-categories/${bodyCreate.data.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Herbs & Spices",
        isActive: false
      }
    });

    expect(resUpdate.statusCode).toBe(200);
    expect(resUpdate.json().data.name).toBe("Herbs & Spices");
    expect(resUpdate.json().data.isActive).toBe(false);

    // 3. Reorder subcategories
    const sc2 = await db.subCategory.create({
      data: { name: "Oil", slug: "oil", categoryId: category.id, displayOrder: 2 }
    });

    const resReorder = await server.inject({
      method: "PUT",
      url: "/api/v1/admin/sub-categories/reorder",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: [
        { id: bodyCreate.data.id, displayOrder: 4 },
        { id: sc2.id, displayOrder: 2 }
      ]
    });
    expect(resReorder.statusCode).toBe(200);

    const dbSc1 = await db.subCategory.findUnique({ where: { id: bodyCreate.data.id } });
    const dbSc2 = await db.subCategory.findUnique({ where: { id: sc2.id } });
    expect(dbSc1?.displayOrder).toBe(4);
    expect(dbSc2?.displayOrder).toBe(2);
  });

  describe("Bulk Category Import Endpoints", () => {
    it("should enforce ADMIN role authorization for validate and confirm", async () => {
      const buyerToken = await generateAccessToken("buyer-123", "BUYER");

      const resVal = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/validate",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { rows: [] }
      });
      expect(resVal.statusCode).toBe(403);

      const resConf = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/confirm",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { rows: [] }
      });
      expect(resConf.statusCode).toBe(403);
    });

    it("should validate bulk categories dry-run without DB writes", async () => {
      const payload = {
        rows: [
          {
            name: "Dairy Products",
            subCategories: [{ name: "Full Cream Milk" }, { name: "Toned Milk" }],
            commerceType: "QUICK_COMMERCE",
            displayOrder: 1
          },
          {
            name: "Bakery Delights",
            subCategories: [{ name: "Brown Bread" }],
            commerceType: "QUICK_COMMERCE",
            displayOrder: 2
          }
        ]
      };

      const res = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/validate",
        headers: { authorization: `Bearer ${adminToken}` },
        payload
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.valid).toBe(true);
      expect(body.data.conflicts).toEqual([]);
      expect(body.data.totalRows).toBe(2);
      expect(body.data.totalSubCategoryRows).toBe(3);

      // Verify zero DB writes
      const catCount = await db.category.count();
      expect(catCount).toBe(0);
    });

    it("should identify category slug conflict on validation", async () => {
      // Pre-insert conflicting category
      await db.category.create({
        data: { name: "Dairy", slug: "dairy", commerceType: "QUICK_COMMERCE" }
      });

      const payload = {
        rows: [
          {
            name: "Dairy",
            subCategories: [],
            commerceType: "QUICK_COMMERCE"
          }
        ]
      };

      const res = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/validate",
        headers: { authorization: `Bearer ${adminToken}` },
        payload
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.valid).toBe(false);
      expect(body.data.conflicts).toEqual([
        {
          row: 1,
          type: "CATEGORY_SLUG_EXISTS",
          name: "Dairy",
          slug: "dairy"
        }
      ]);

      const catCount = await db.category.count();
      expect(catCount).toBe(1); // Only the pre-existing one
    });

    it("should confirm and insert categories/subcategories with mode=strict", async () => {
      const payload = {
        rows: [
          {
            name: "Dairy Products",
            subCategories: [{ name: "Full Cream Milk" }],
            commerceType: "QUICK_COMMERCE",
            displayOrder: 1
          }
        ]
      };

      const res = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/confirm?mode=strict",
        headers: { authorization: `Bearer ${adminToken}` },
        payload
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.inserted).toBe(1);
      expect(body.data.skipped).toBe(0);

      // Verify DB
      const cat = await db.category.findUnique({
        where: { slug: "dairy-products" },
        include: { subCategories: true }
      });
      expect(cat).toBeDefined();
      expect(cat?.name).toBe("Dairy Products");
      expect(cat?.subCategories.length).toBe(1);
      expect(cat?.subCategories[0]?.slug).toBe("full-cream-milk");

      // Verify AuditLog
      const audit = await db.auditLog.findFirst({
        where: { action: "ADMIN_BULK_CATEGORY_INSERT" }
      });
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe("admin-123");
      expect((audit?.newValue as Record<string, unknown>)?.insertedCount).toBe(1);
    });

    it("should reject confirm with 409 Conflict if conflicts exist in mode=strict", async () => {
      await db.category.create({
        data: { name: "Dairy", slug: "dairy", commerceType: "QUICK_COMMERCE" }
      });

      const payload = {
        rows: [
          {
            name: "Dairy",
            subCategories: [],
            commerceType: "QUICK_COMMERCE"
          }
        ]
      };

      const res = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/confirm?mode=strict",
        headers: { authorization: `Bearer ${adminToken}` },
        payload
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("BULK_CONFLICT");
      expect(body.error.details.conflicts).toEqual([
        {
          row: 1,
          type: "CATEGORY_SLUG_EXISTS",
          name: "Dairy",
          slug: "dairy"
        }
      ]);

      // Category count should remain 1 (no new insert)
      const count = await db.category.count();
      expect(count).toBe(1);
    });

    it("should confirm and skip conflicts if mode=skip", async () => {
      await db.category.create({
        data: { name: "Dairy", slug: "dairy", commerceType: "QUICK_COMMERCE" }
      });

      const payload = {
        rows: [
          {
            name: "Dairy",
            subCategories: [],
            commerceType: "QUICK_COMMERCE"
          },
          {
            name: "Bakery",
            subCategories: [{ name: "Toast" }],
            commerceType: "QUICK_COMMERCE"
          }
        ]
      };

      const res = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/confirm?mode=skip",
        headers: { authorization: `Bearer ${adminToken}` },
        payload
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.inserted).toBe(1);
      expect(body.data.skipped).toBe(1);
      expect(body.data.insertedNames).toEqual(["Bakery"]);
      expect(body.data.skippedNames).toEqual(["Dairy"]);

      // Verify DB has pre-existing Dairy and new Bakery
      const count = await db.category.count();
      expect(count).toBe(2);

      const bakery = await db.category.findUnique({
        where: { slug: "bakery" },
        include: { subCategories: true }
      });
      expect(bakery).toBeDefined();
      expect(bakery?.subCategories.length).toBe(1);
    });

    it("should return 400 validation error if body fails zod validation", async () => {
      // Empty rows
      const res1 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/confirm",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { rows: [] }
      });
      expect(res1.statusCode).toBe(400);

      // Missing subcategories / invalid format
      const res2 = await server.inject({
        method: "POST",
        url: "/api/v1/admin/bulk/categories/confirm",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { rows: [{ name: "" }] }
      });
      expect(res2.statusCode).toBe(400);
    });
  });
});
