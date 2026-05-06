import { ForbiddenError, NotFoundError, UnprocessableEntityError, ValidationError } from "@gorola/shared";
import type { Category, PrismaClient, Product, Store } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";

async function cleanCatalogIntegrationGraph(db: PrismaClient): Promise<void> {
  await db.riderLocation.deleteMany();
  await db.deliveryRider.deleteMany();
  await db.stockMovement.deleteMany();
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
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
}

describe("ProductVariantRepository", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const repo = new ProductVariantRepository(db);

  let store: Store;
  let category: Category;
  let subCategory: { id: string };
  let product: Product;

  beforeEach(async () => {
    await cleanCatalogIntegrationGraph(db);
    store = await storeRepo.create({
      name: "V Store",
      description: "d",
      phone: "+911111111112",
      address: "Lane"
    });
    category = await categoryRepo.create({ slug: "v-cat", name: "Cat", imageUrl: "https://example.com/cat.jpg" });
    subCategory = await db.subCategory.create({
      data: { slug: "v-sub", name: "Sub", categoryId: category.id }
    });
    product = await productRepo.create({
      storeId: store.id,
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: "Base Product",
      description: "d",
      imageUrl: "https://p"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates a variant with label, price, unit", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "500g",
        price: "99.50",
        stockQty: 10,
        unit: "pack"
      });
      expect(v.id).toBeTruthy();
      expect(v.productId).toBe(product.id);
      expect(v.label).toBe("500g");
      expect(v.stockQty).toBe(10);
      expect(v.unit).toBe("pack");
      expect(v.isActive).toBe(true);
      expect(String(v.price)).toMatch(/99\.5/);
    });

    it("throws NotFoundError when productId does not exist", async () => {
      await expect(
        repo.create({
          productId: "nonexistent_cuid_xyz",
          label: "x",
          price: "1",
          unit: "u"
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("findById", () => {
    it("returns variant by id", async () => {
      const created = await repo.create({
        productId: product.id,
        label: "L",
        price: "1.00",
        unit: "u"
      });
      const found = await repo.findById(created.id);
      expect(found?.label).toBe("L");
    });

    it("returns null when id does not exist", async () => {
      expect(await repo.findById("nonexistent_cuid_xyz")).toBeNull();
    });

    it("returns null for inactive variant by default", async () => {
      const created = await repo.create({
        productId: product.id,
        label: "off",
        price: "2",
        unit: "u"
      });
      await db.productVariant.update({ where: { id: created.id }, data: { isActive: false } });
      expect(await repo.findById(created.id)).toBeNull();
    });

    it("returns inactive variant when includeInactive is true", async () => {
      const created = await repo.create({
        productId: product.id,
        label: "off2",
        price: "2",
        unit: "u"
      });
      await db.productVariant.update({ where: { id: created.id }, data: { isActive: false } });
      const found = await repo.findById(created.id, { includeInactive: true });
      expect(found?.isActive).toBe(false);
    });
  });

  describe("findByProductId", () => {
    it("returns active variants ordered by label", async () => {
      await repo.create({
        productId: product.id,
        label: "Zebra",
        price: "1",
        unit: "u"
      });
      await repo.create({
        productId: product.id,
        label: "Apple",
        price: "2",
        unit: "u"
      });
      const off = await repo.create({
        productId: product.id,
        label: "Off",
        price: "3",
        unit: "u",
        isActive: false
      });
      const list = await repo.findByProductId(product.id);
      expect(list.map((x) => x.label)).toEqual(["Apple", "Zebra"]);
      expect(list.some((x) => x.id === off.id)).toBe(false);
    });

    it("includes inactive when includeInactive is true", async () => {
      const on = await repo.create({
        productId: product.id,
        label: "On",
        price: "1",
        unit: "u"
      });
      const off = await repo.create({
        productId: product.id,
        label: "Off",
        price: "2",
        unit: "u",
        isActive: false
      });
      const list = await repo.findByProductId(product.id, { includeInactive: true });
      expect(list.map((x) => x.id).sort()).toEqual([on.id, off.id].sort());
    });

    it("returns empty array when product has no variants", async () => {
      expect(await repo.findByProductId(product.id)).toEqual([]);
    });
  });

  describe("update", () => {
    it("updates label, price, stockQty, unit, isActive", async () => {
      const created = await repo.create({
        productId: product.id,
        label: "Old",
        price: "10.00",
        stockQty: 1,
        unit: "ea"
      });
      const updated = await repo.update(created.id, {
        label: "New",
        price: "20.50",
        stockQty: 5,
        unit: "box",
        isActive: false
      });
      expect(updated.label).toBe("New");
      expect(updated.stockQty).toBe(5);
      expect(updated.unit).toBe("box");
      expect(updated.isActive).toBe(false);
      expect(String(updated.price)).toMatch(/20\.5/);
    });

    it("throws NotFoundError when id does not exist", async () => {
      await expect(
        repo.update("nonexistent_cuid_xyz", { label: "x" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("decrementStock and incrementStock", () => {
    it("decrements within a transaction and returns before/after", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "d1",
        price: "1",
        stockQty: 20,
        unit: "u"
      });
      await db.$transaction(async (tx) => {
        const r = await repo.decrementStock(v.id, 4, store.id, tx);
        expect(r.stockQtyBefore).toBe(20);
        expect(r.stockQtyAfter).toBe(16);
      });
      const v2 = await db.productVariant.findUniqueOrThrow({ where: { id: v.id } });
      expect(v2.stockQty).toBe(16);
    });

    it("rejects non-positive quantity", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "d2",
        price: "1",
        stockQty: 5,
        unit: "u"
      });
      await expect(
        db.$transaction((tx) => repo.decrementStock(v.id, 0, store.id, tx))
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("throws when variant is not in the given store", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "d3",
        price: "1",
        stockQty: 5,
        unit: "u"
      });
      const other = await storeRepo.create({
        name: "Other",
        description: "d",
        phone: "+911199999999",
        address: "A"
      });
      await expect(
        db.$transaction((tx) => repo.decrementStock(v.id, 1, other.id, tx))
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws UnprocessableEntityError when not enough stock", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "d4",
        price: "1",
        stockQty: 2,
        unit: "u"
      });
      await expect(
        db.$transaction((tx) => repo.decrementStock(v.id, 5, store.id, tx))
      ).rejects.toBeInstanceOf(UnprocessableEntityError);
    });

    it("increments stock in a transaction", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "d5",
        price: "1",
        stockQty: 3,
        unit: "u"
      });
      await db.$transaction(async (tx) => {
        const r = await repo.incrementStock(v.id, 2, store.id, tx);
        expect(r.stockQtyBefore).toBe(3);
        expect(r.stockQtyAfter).toBe(5);
      });
    });
  });

  describe("Stock Flags (lowStockThreshold, isLowStock, isInStock)", () => {
    it("initializes default flags correctly", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "flags1",
        price: "1",
        stockQty: 10,
        unit: "u"
      });
      expect(v.lowStockThreshold).toBe(5);
      expect(v.isLowStock).toBe(false);
      expect(v.isInStock).toBe(true);
    });

    it("updates flags correctly on decrement to low stock", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "flags2",
        price: "1",
        stockQty: 10,
        unit: "u"
      });
      await db.$transaction(async (tx) => {
        await repo.decrementStock(v.id, 6, store.id, tx);
      });
      const updated = await db.productVariant.findUniqueOrThrow({ where: { id: v.id } });
      expect(updated.stockQty).toBe(4);
      expect(updated.isLowStock).toBe(true);
      expect(updated.isInStock).toBe(true);
    });

    it("updates flags correctly on decrement to zero stock", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "flags3",
        price: "1",
        stockQty: 5,
        unit: "u"
      });
      await db.$transaction(async (tx) => {
        await repo.decrementStock(v.id, 5, store.id, tx);
      });
      const updated = await db.productVariant.findUniqueOrThrow({ where: { id: v.id } });
      expect(updated.stockQty).toBe(0);
      expect(updated.isLowStock).toBe(true);
      expect(updated.isInStock).toBe(false);
    });

    it("updates flags correctly on increment from zero stock", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "flags4",
        price: "1",
        stockQty: 0,
        unit: "u"
      });
      await db.$transaction(async (tx) => {
        await repo.incrementStock(v.id, 1, store.id, tx);
      });
      const updated = await db.productVariant.findUniqueOrThrow({ where: { id: v.id } });
      expect(updated.stockQty).toBe(1);
      expect(updated.isLowStock).toBe(true);
      expect(updated.isInStock).toBe(true);
    });

    it("updates flags correctly on increment above threshold", async () => {
      const v = await repo.create({
        productId: product.id,
        label: "flags5",
        price: "1",
        stockQty: 4,
        unit: "u"
      });
      await db.$transaction(async (tx) => {
        await repo.incrementStock(v.id, 10, store.id, tx);
      });
      const updated = await db.productVariant.findUniqueOrThrow({ where: { id: v.id } });
      expect(updated.stockQty).toBe(14);
      expect(updated.isLowStock).toBe(false);
      expect(updated.isInStock).toBe(true);
    });
  });

  describe("security", () => {
    it("does not treat SQL injection-like label as raw SQL", async () => {
      const malicious = "var'; DROP TABLE \"ProductVariant\";--";
      const v = await repo.create({
        productId: product.id,
        label: malicious,
        price: "1",
        unit: "u"
      });
      const found = await repo.findById(v.id);
      expect(found?.label).toBe(malicious);
      expect(await db.productVariant.count()).toBeGreaterThanOrEqual(1);
    });
  });
});
