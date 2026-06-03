import { ConflictError, NotFoundError } from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";

async function cleanCatalogIntegrationGraph(db: PrismaClient): Promise<void> {
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

describe("CategoryRepository", () => {
  const db = getPrismaClient();
  const repo = new CategoryRepository(db);

  beforeEach(async () => {
    await cleanCatalogIntegrationGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates a category with slug and name", async () => {
      const c = await repo.create({
        slug: "snacks",
        name: "Snacks",
        displayOrder: 3
      });
      expect(c.id).toBeTruthy();
      expect(c.slug).toBe("snacks");
      expect(c.name).toBe("Snacks");
      expect(c.displayOrder).toBe(3);
      expect(c.isActive).toBe(true);
      expect(c.imageUrl).toBeNull();
    });

    it("throws ConflictError when slug already exists", async () => {
      await repo.create({ slug: "dup", name: "One" });
      await expect(repo.create({ slug: "dup", name: "Two" })).rejects.toThrow(ConflictError);
    });
  });

  describe("findById", () => {
    it("returns category by id", async () => {
      const created = await repo.create({ slug: "by-id", name: "By Id" });
      const found = await repo.findById(created.id);
      expect(found?.slug).toBe("by-id");
    });

    it("returns null when id does not exist", async () => {
      expect(await repo.findById("nonexistent_cuid_xyz")).toBeNull();
    });

    it("returns null for inactive category by default", async () => {
      const created = await repo.create({ slug: "off", name: "Off" });
      await db.category.update({ where: { id: created.id }, data: { isActive: false } });
      expect(await repo.findById(created.id)).toBeNull();
    });

    it("returns inactive category when includeInactive is true", async () => {
      const created = await repo.create({ slug: "off2", name: "Off2" });
      await db.category.update({ where: { id: created.id }, data: { isActive: false } });
      const found = await repo.findById(created.id, { includeInactive: true });
      expect(found?.isActive).toBe(false);
    });
  });

  describe("findBySlug", () => {
    it("returns category by slug", async () => {
      await repo.create({ slug: "slug-a", name: "A" });
      const found = await repo.findBySlug("slug-a");
      expect(found?.name).toBe("A");
    });

    it("returns null when slug does not exist", async () => {
      expect(await repo.findBySlug("missing-slug")).toBeNull();
    });

    it("returns null for inactive category by default", async () => {
      await repo.create({ slug: "inact-slug", name: "I" });
      const row = await repo.findBySlug("inact-slug");
      await db.category.update({ where: { id: row!.id }, data: { isActive: false } });
      expect(await repo.findBySlug("inact-slug")).toBeNull();
    });
  });

  describe("findAll", () => {
    it("returns only active categories by default ordered by displayOrder then name", async () => {
      await repo.create({ slug: "z-cat", name: "Zebra", displayOrder: 2 });
      await repo.create({ slug: "a-cat", name: "Apple", displayOrder: 1 });
      const inactive = await repo.create({ slug: "hidden", name: "Hidden", displayOrder: 0 });
      await db.category.update({ where: { id: inactive.id }, data: { isActive: false } });

      const list = await repo.findAll();
      expect(list.map((x) => x.slug)).toEqual(["a-cat", "z-cat"]);
    });

    it("returns empty array when no active categories", async () => {
      const c = await repo.create({ slug: "only", name: "Only" });
      await db.category.update({ where: { id: c.id }, data: { isActive: false } });
      expect(await repo.findAll()).toEqual([]);
    });

    it("includes inactive when includeInactive is true", async () => {
      const a = await repo.create({ slug: "act", name: "Act" });
      const b = await repo.create({ slug: "inact", name: "Inact" });
      await db.category.update({ where: { id: b.id }, data: { isActive: false } });
      const list = await repo.findAll({ includeInactive: true });
      expect(list.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
    });
  });

  describe("update", () => {
    it("updates fields", async () => {
      const created = await repo.create({ slug: "old-slug", name: "Old", displayOrder: 0 });
      const updated = await repo.update(created.id, {
        slug: "new-slug",
        name: "New",
        imageUrl: "https://example.com/apple.jpg",
        displayOrder: 5,
        isActive: false
      });
      expect(updated.slug).toBe("new-slug");
      expect(updated.name).toBe("New");
      expect(updated.imageUrl).toBe("https://example.com/apple.jpg");
      expect(updated.displayOrder).toBe(5);
      expect(updated.isActive).toBe(false);
    });

    it("throws NotFoundError when id does not exist", async () => {
      await expect(
        repo.update("nonexistent_cuid_xyz", { name: "x" })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError when slug conflicts with another category", async () => {
      await repo.create({ slug: "taken", name: "T" });
      const other = await repo.create({ slug: "other", name: "O" });
      await expect(repo.update(other.id, { slug: "taken" })).rejects.toThrow(ConflictError);
    });
  });

  describe("security", () => {
    it("does not treat SQL injection-like slug as raw SQL", async () => {
      const malicious = "cat'; DROP TABLE \"Category\";--";
      const c = await repo.create({ slug: malicious, name: "Safe" });
      const found = await repo.findBySlug(malicious);
      expect(found?.id).toBe(c.id);
      expect(await db.category.count()).toBeGreaterThanOrEqual(1);
    });
  });
});
