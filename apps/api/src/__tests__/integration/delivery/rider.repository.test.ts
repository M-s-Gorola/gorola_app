import { NotImplementedError } from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { RiderRepository } from "../../../modules/delivery/rider.repository.js";

async function cleanStoreGraph(db: PrismaClient): Promise<void> {
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
  await db.admin.deleteMany();
}

describe("RiderRepository", () => {
  const db = getPrismaClient();
  const repo = new RiderRepository(db);
  let storeId: string;

  beforeEach(async () => {
    await cleanStoreGraph(db);
    const store = await db.store.create({
      data: {
        name: "Test Store",
        description: "Test description",
        phone: "+919999999999",
        address: "Test address"
      }
    });
    storeId = store.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates a delivery rider with credentials", async () => {
      const rider = await repo.create({
        name: "John Rider",
        phone: "+919900000001",
        email: "john.rider@test.com",
        passwordHash: "somehash123",
        storeId
      });

      expect(rider.id).toBeTruthy();
      expect(rider.name).toBe("John Rider");
      expect(rider.phone).toBe("+919900000001");
      expect(rider.email).toBe("john.rider@test.com");
      expect(rider.passwordHash).toBe("somehash123");
      expect(rider.storeId).toBe(storeId);
      expect(rider.isActive).toBe(true);
      expect(rider.isDeleted).toBe(false);
    });
  });

  describe("findById", () => {
    it("returns rider by id", async () => {
      const created = await repo.create({
        name: "Rider 1",
        phone: "+919900000002",
        email: "rider1@test.com",
        passwordHash: "hash",
        storeId
      });

      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("returns null when id does not exist", async () => {
      const found = await repo.findById("nonexistent_id");
      expect(found).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("returns rider by email", async () => {
      const created = await repo.create({
        name: "Rider 2",
        phone: "+919900000003",
        email: "rider2@test.com",
        passwordHash: "hash",
        storeId
      });

      const found = await repo.findByEmail("rider2@test.com");
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("returns null when email does not exist", async () => {
      const found = await repo.findByEmail("unknown@test.com");
      expect(found).toBeNull();
    });
  });

  describe("stubs", () => {
    it("getActiveByStore throws NotImplementedError", async () => {
      await expect(repo.getActiveByStore(storeId)).rejects.toThrow(NotImplementedError);
    });

    it("updateLocation throws NotImplementedError", async () => {
      await expect(
        repo.updateLocation("rider_1", { lat: "30.1234567", lng: "78.1234567" })
      ).rejects.toThrow(NotImplementedError);
    });
  });
});