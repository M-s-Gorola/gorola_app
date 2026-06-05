import { NotFoundError } from "@gorola/shared";
import type { Category, PrismaClient, Store } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";

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

describe("ProductRepository", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const repo = new ProductRepository(db);

  let store: Store;
  let category: Category;
  let subCategory: { id: string };

  beforeEach(async () => {
    await cleanCatalogIntegrationGraph(db);
    store = await storeRepo.create({
      name: "Fixture Store",
      description: "d",
      phone: "+911111111111",
      address: "Road"
    });
    category = await categoryRepo.create({ slug: "fixture-cat", name: "Fixture", imageUrl: "https://example.com/cat.jpg" });
    subCategory = await db.subCategory.create({
      data: { slug: "fixture-sub", name: "Fixture Sub", categoryId: category.id }
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates a product linked to store and category", async () => {
      const p = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Rice",
        description: "White rice",
        imageUrl: "https://example.com/rice.jpg"
      });
      expect(p.id).toBeTruthy();
      expect(p.storeId).toBe(store.id);
      expect(p.categoryId).toBe(category.id);
      expect(p.name).toBe("Rice");
      expect(p.isActive).toBe(true);
      expect(p.isDeleted).toBe(false);
    });

    it("throws NotFoundError when storeId does not exist", async () => {
      await expect(
        repo.create({
          storeId: "nonexistent_cuid_xyz",
          categoryId: category.id,
          subCategoryId: subCategory.id,
          name: "x",
          description: "d",
          imageUrl: "https://x"
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when categoryId does not exist", async () => {
      await expect(
        repo.create({
          storeId: store.id,
          categoryId: "nonexistent_cuid_xyz",
          subCategoryId: subCategory.id,
          name: "x",
          description: "d",
          imageUrl: "https://x"
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("findById", () => {
    it("returns product by id", async () => {
      const created = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Find",
        description: "d",
        imageUrl: "https://i"
      });
      const found = await repo.findById(created.id);
      expect(found?.name).toBe("Find");
    });

    it("returns null when id does not exist", async () => {
      expect(await repo.findById("nonexistent_cuid_xyz")).toBeNull();
    });

    it("returns null for soft-deleted product by default", async () => {
      const created = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Del",
        description: "d",
        imageUrl: "https://i"
      });
      await db.product.update({ where: { id: created.id }, data: { isDeleted: true } });
      expect(await repo.findById(created.id)).toBeNull();
    });

    it("returns soft-deleted product when includeDeleted is true", async () => {
      const created = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Del2",
        description: "d",
        imageUrl: "https://i"
      });
      await db.product.update({ where: { id: created.id }, data: { isDeleted: true } });
      const found = await repo.findById(created.id, { includeDeleted: true });
      expect(found?.isDeleted).toBe(true);
    });
  });

  describe("findByStoreId", () => {
    it("returns active non-deleted products for store ordered by name", async () => {
      await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Zebra",
        description: "z",
        imageUrl: "https://z"
      });
      await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Apple",
        description: "a",
        imageUrl: "https://a"
      });
      const inactive = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Off",
        description: "o",
        imageUrl: "https://o",
        isActive: false
      });
      const deleted = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Gone",
        description: "g",
        imageUrl: "https://g"
      });
      await db.product.update({ where: { id: deleted.id }, data: { isDeleted: true } });

      const list = await repo.findByStoreId(store.id);
      expect(list.map((x) => x.name)).toEqual(["Apple", "Zebra"]);
      expect(list.some((x) => x.id === inactive.id)).toBe(false);
      expect(list.some((x) => x.id === deleted.id)).toBe(false);
    });

    it("includes inactive when includeInactive is true", async () => {
      await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "On",
        description: "o",
        imageUrl: "https://o"
      });
      const off = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Off",
        description: "f",
        imageUrl: "https://f",
        isActive: false
      });
      const list = await repo.findByStoreId(store.id, { includeInactive: true });
      expect(list.some((x) => x.id === off.id)).toBe(true);
    });

    it("returns empty array when store has no matching products", async () => {
      expect(await repo.findByStoreId(store.id)).toEqual([]);
    });
  });

  describe("update", () => {
    it("updates fields including categoryId", async () => {
      const cat2 = await categoryRepo.create({ slug: "cat-2", name: "Second" });
      const created = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Old",
        description: "d",
        imageUrl: "https://o"
      });
      const updated = await repo.update(created.id, {
        name: "New",
        description: "nd",
        imageUrl: "https://n",
        categoryId: cat2.id,
        isActive: false
      });
      expect(updated.name).toBe("New");
      expect(updated.categoryId).toBe(cat2.id);
      expect(updated.isActive).toBe(false);
    });

    it("throws NotFoundError when id does not exist", async () => {
      await expect(
        repo.update("nonexistent_cuid_xyz", { name: "x" })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when categoryId does not exist", async () => {
      const created = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "P",
        description: "d",
        imageUrl: "https://i"
      });
      await expect(
        repo.update(created.id, { categoryId: "nonexistent_cuid_xyz" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("security", () => {
    it("does not treat SQL injection-like name as raw SQL", async () => {
      const malicious = "item'; DROP TABLE \"Product\";--";
      const p = await repo.create({
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: malicious,
        description: "d",
        imageUrl: "https://i"
      });
      const found = await repo.findById(p.id);
      expect(found?.name).toBe(malicious);
      expect(await db.product.count()).toBeGreaterThanOrEqual(1);
    });
  });
});
