import { NotFoundError } from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";

async function cleanStoreGraph(db: PrismaClient): Promise<void> {
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
}

describe("StoreRepository", () => {
  const db = getPrismaClient();
  const repo = new StoreRepository(db);

  beforeEach(async () => {
    await cleanStoreGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates a store with required fields", async () => {
      const store = await repo.create({
        name: "Hill Grocer",
        description: "Fresh produce",
        phone: "+911234567890",
        address: "Mall Road, Mussoorie"
      });
      expect(store.id).toBeTruthy();
      expect(store.name).toBe("Hill Grocer");
      expect(store.description).toBe("Fresh produce");
      expect(store.phone).toBe("+911234567890");
      expect(store.address).toBe("Mall Road, Mussoorie");
      expect(store.isActive).toBe(true);
      expect(store.isDeleted).toBe(false);
      expect(store.weatherModeDeliveryWindow).toBeNull();
    });

    it("creates a store with isActive false", async () => {
      const store = await repo.create({
        name: "Closed Shop",
        description: "Temporarily closed",
        phone: "+911234567891",
        address: "Landour",
        isActive: false
      });
      expect(store.isActive).toBe(false);
    });

    it("creates a store with weatherModeDeliveryWindow", async () => {
      const store = await repo.create({
        name: "Rain Shop",
        description: "Weather mode",
        phone: "+911234567892",
        address: "Kempty",
        weatherModeDeliveryWindow: "90-120 min"
      });
      expect(store.weatherModeDeliveryWindow).toBe("90-120 min");
    });
  });

  describe("findById", () => {
    it("returns store by id", async () => {
      const created = await repo.create({
        name: "Find Me",
        description: "d",
        phone: "+911234567900",
        address: "a"
      });
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("returns null when id does not exist", async () => {
      const found = await repo.findById("nonexistent_cuid_xyz");
      expect(found).toBeNull();
    });

    it("returns null for soft-deleted store by default", async () => {
      const created = await repo.create({
        name: "Gone",
        description: "d",
        phone: "+911234567901",
        address: "a"
      });
      await db.store.update({ where: { id: created.id }, data: { isDeleted: true } });
      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it("returns soft-deleted store when includeDeleted is true", async () => {
      const created = await repo.create({
        name: "Gone2",
        description: "d",
        phone: "+911234567902",
        address: "a"
      });
      await db.store.update({ where: { id: created.id }, data: { isDeleted: true } });
      const found = await repo.findById(created.id, { includeDeleted: true });
      expect(found).not.toBeNull();
      expect(found?.isDeleted).toBe(true);
    });
  });

  describe("findAll", () => {
    it("returns only active, non-deleted stores by default", async () => {
      await repo.create({
        name: "Alpha Mart",
        description: "a",
        phone: "+911234567910",
        address: "x"
      });
      await repo.create({
        name: "Beta Mart",
        description: "b",
        phone: "+911234567911",
        address: "y",
        isActive: false
      });
      const gamma = await repo.create({
        name: "Gamma Mart",
        description: "c",
        phone: "+911234567912",
        address: "z"
      });
      await db.store.update({ where: { id: gamma.id }, data: { isDeleted: true } });

      const list = await repo.findAll();
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe("Alpha Mart");
    });

    it("returns stores ordered by name ascending", async () => {
      await repo.create({
        name: "Zebra",
        description: "z",
        phone: "+911234567920",
        address: "a"
      });
      await repo.create({
        name: "Apple",
        description: "a",
        phone: "+911234567921",
        address: "b"
      });
      const names = (await repo.findAll()).map((s) => s.name);
      expect(names).toEqual(["Apple", "Zebra"]);
    });

    it("returns empty array when no matching stores", async () => {
      expect(await repo.findAll()).toEqual([]);
    });

    it("includes inactive stores when includeInactive is true", async () => {
      await repo.create({
        name: "Open",
        description: "o",
        phone: "+911234567930",
        address: "a"
      });
      await repo.create({
        name: "Shut",
        description: "s",
        phone: "+911234567931",
        address: "b",
        isActive: false
      });
      const list = await repo.findAll({ includeInactive: true });
      expect(list).toHaveLength(2);
    });

    it("excludes soft-deleted stores even when includeInactive is true", async () => {
      const s = await repo.create({
        name: "DeletedInactive",
        description: "d",
        phone: "+911234567932",
        address: "c",
        isActive: false
      });
      await db.store.update({ where: { id: s.id }, data: { isDeleted: true } });
      const list = await repo.findAll({ includeInactive: true });
      expect(list).toHaveLength(0);
    });

    it("includes soft-deleted when includeDeleted and includeInactive are true", async () => {
      const s = await repo.create({
        name: "Zombie",
        description: "z",
        phone: "+911234567933",
        address: "d",
        isActive: false
      });
      await db.store.update({ where: { id: s.id }, data: { isDeleted: true } });
      const list = await repo.findAll({ includeInactive: true, includeDeleted: true });
      expect(list).toHaveLength(1);
      expect(list[0]?.isDeleted).toBe(true);
    });
  });

  describe("update", () => {
    it("updates name, description, phone, address, isActive, weather window", async () => {
      const created = await repo.create({
        name: "Old",
        description: "old desc",
        phone: "+911234567940",
        address: "old addr"
      });
      const updated = await repo.update(created.id, {
        name: "New",
        description: "new desc",
        phone: "+911234567941",
        address: "new addr",
        isActive: false,
        weatherModeDeliveryWindow: "45-60 min"
      });
      expect(updated.name).toBe("New");
      expect(updated.description).toBe("new desc");
      expect(updated.phone).toBe("+911234567941");
      expect(updated.address).toBe("new addr");
      expect(updated.isActive).toBe(false);
      expect(updated.weatherModeDeliveryWindow).toBe("45-60 min");
    });

    it("throws NotFoundError when id does not exist", async () => {
      await expect(
        repo.update("nonexistent_cuid_xyz", { name: "Nobody" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("security", () => {
    it("does not treat SQL injection-like strings in text fields as raw SQL", async () => {
      const malicious = "Hill'; DROP TABLE \"Store\";--";
      const store = await repo.create({
        name: malicious,
        description: "safe",
        phone: "+911234567950",
        address: "addr"
      });
      const found = await repo.findById(store.id);
      expect(found?.name).toBe(malicious);
      const count = await db.store.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
