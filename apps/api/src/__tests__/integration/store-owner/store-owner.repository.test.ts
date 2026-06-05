import { ConflictError, NotFoundError } from "@gorola/shared";
import type { PrismaClient, Store } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { StoreOwnerRepository } from "../../../modules/store-owner/store-owner.repository.js";

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

async function seedStore(storeRepo: StoreRepository): Promise<Store> {
  return storeRepo.create({
    name: "Test Store",
    description: "For owners",
    phone: "+911111111111",
    address: "Test Road"
  });
}

describe("StoreOwnerRepository", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const repo = new StoreOwnerRepository(db);

  let store: Store;

  beforeEach(async () => {
    await cleanStoreGraph(db);
    store = await seedStore(storeRepo);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates a store owner linked to store", async () => {
      const owner = await repo.create({
        email: "owner@example.com",
        passwordHash: "hashed_secret",
        storeId: store.id
      });
      expect(owner.id).toBeTruthy();
      expect(owner.email).toBe("owner@example.com");
      expect(owner.passwordHash).toBe("hashed_secret");
      expect(owner.storeId).toBe(store.id);
      expect(owner.totpEnabled).toBe(false);
      expect(owner.totpSecret).toBeNull();
      expect(owner.isDeleted).toBe(false);
    });

    it("creates with totp fields", async () => {
      const owner = await repo.create({
        email: "2fa@example.com",
        passwordHash: "hash",
        storeId: store.id,
        totpSecret: "SECRETB32",
        totpEnabled: true
      });
      expect(owner.totpSecret).toBe("SECRETB32");
      expect(owner.totpEnabled).toBe(true);
    });

    it("throws ConflictError when email already exists", async () => {
      await repo.create({
        email: "dup@example.com",
        passwordHash: "a",
        storeId: store.id
      });
      await expect(
        repo.create({
          email: "dup@example.com",
          passwordHash: "b",
          storeId: store.id
        })
      ).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError when storeId does not exist", async () => {
      await expect(
        repo.create({
          email: "orphan@example.com",
          passwordHash: "x",
          storeId: "nonexistent_cuid_xyz"
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("findById", () => {
    it("returns owner by id", async () => {
      const created = await repo.create({
        email: "byid@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("returns null when id does not exist", async () => {
      expect(await repo.findById("nonexistent_cuid_xyz")).toBeNull();
    });

    it("returns null for soft-deleted owner by default", async () => {
      const created = await repo.create({
        email: "del@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      await db.storeOwner.update({ where: { id: created.id }, data: { isDeleted: true } });
      expect(await repo.findById(created.id)).toBeNull();
    });

    it("returns soft-deleted owner when includeDeleted is true", async () => {
      const created = await repo.create({
        email: "del2@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      await db.storeOwner.update({ where: { id: created.id }, data: { isDeleted: true } });
      const found = await repo.findById(created.id, { includeDeleted: true });
      expect(found?.isDeleted).toBe(true);
    });
  });

  describe("findByEmail", () => {
    it("returns owner by email", async () => {
      await repo.create({
        email: "mail@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      const found = await repo.findByEmail("mail@example.com");
      expect(found?.email).toBe("mail@example.com");
    });

    it("returns null when email does not exist", async () => {
      expect(await repo.findByEmail("missing@example.com")).toBeNull();
    });

    it("returns null for soft-deleted owner by default", async () => {
      const created = await repo.create({
        email: "gone@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      await db.storeOwner.update({ where: { id: created.id }, data: { isDeleted: true } });
      expect(await repo.findByEmail("gone@example.com")).toBeNull();
    });

    it("returns soft-deleted owner when includeDeleted is true", async () => {
      const created = await repo.create({
        email: "gone2@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      await db.storeOwner.update({ where: { id: created.id }, data: { isDeleted: true } });
      const found = await repo.findByEmail("gone2@example.com", { includeDeleted: true });
      expect(found?.isDeleted).toBe(true);
    });
  });

  describe("update", () => {
    it("updates email, passwordHash, totp fields, storeId", async () => {
      const other = await storeRepo.create({
        name: "Other",
        description: "d",
        phone: "+922222222222",
        address: "Elsewhere"
      });
      const created = await repo.create({
        email: "old@example.com",
        passwordHash: "oldhash",
        storeId: store.id
      });
      const updated = await repo.update(created.id, {
        email: "new@example.com",
        passwordHash: "newhash",
        totpSecret: "TOTP",
        totpEnabled: true,
        storeId: other.id
      });
      expect(updated.email).toBe("new@example.com");
      expect(updated.passwordHash).toBe("newhash");
      expect(updated.totpSecret).toBe("TOTP");
      expect(updated.totpEnabled).toBe(true);
      expect(updated.storeId).toBe(other.id);
    });

    it("throws NotFoundError when id does not exist", async () => {
      await expect(
        repo.update("nonexistent_cuid_xyz", { email: "x@y.com" })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError when email conflicts with another owner", async () => {
      await repo.create({
        email: "a@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      const b = await repo.create({
        email: "b@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      await expect(repo.update(b.id, { email: "a@example.com" })).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError when storeId does not exist", async () => {
      const created = await repo.create({
        email: "move@example.com",
        passwordHash: "h",
        storeId: store.id
      });
      await expect(
        repo.update(created.id, { storeId: "nonexistent_cuid_xyz" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("security", () => {
    it("does not treat SQL injection-like email string as raw SQL", async () => {
      const malicious = "owner'; DROP TABLE \"StoreOwner\";--@x.com";
      const owner = await repo.create({
        email: malicious,
        passwordHash: "h",
        storeId: store.id
      });
      const found = await repo.findByEmail(malicious);
      expect(found?.id).toBe(owner.id);
      expect(await db.storeOwner.count()).toBeGreaterThanOrEqual(1);
    });
  });
});
