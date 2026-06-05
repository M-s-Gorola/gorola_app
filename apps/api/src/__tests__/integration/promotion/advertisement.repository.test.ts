import { NotFoundError } from "@gorola/shared";
import type { PrismaClient, Store } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { AdvertisementRepository } from "../../../modules/promotion/advertisement.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";

async function cleanPromotionGraph(db: PrismaClient): Promise<void> {
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

describe("AdvertisementRepository", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const repo = new AdvertisementRepository(db);

  let store: Store;

  beforeEach(async () => {
    await cleanPromotionGraph(db);
    store = await storeRepo.create({
      name: "Promo Store",
      description: "d",
      phone: "+911111111166",
      address: "Road"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates an advertisement", async () => {
      const ad = await repo.create({
        storeId: store.id,
        title: "Festive Offer",
        imageUrl: "https://example.com/ad.jpg",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.000Z")
      });
      expect(ad.storeId).toBe(store.id);
      expect(ad.title).toBe("Festive Offer");
      expect(ad.isActive).toBe(true);
      expect(ad.isApproved).toBe(false);
    });

    it("throws NotFoundError when store does not exist", async () => {
      await expect(
        repo.create({
          storeId: "nonexistent_cuid_xyz",
          title: "Offer",
          imageUrl: "https://example.com/ad.jpg",
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          endsAt: new Date("2026-12-31T23:59:59.000Z")
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("findActive", () => {
    it("returns only active, approved, in-window ads", async () => {
      const now = new Date("2026-06-01T10:00:00.000Z");

      const good = await repo.create({
        storeId: store.id,
        title: "Good",
        imageUrl: "https://example.com/good.jpg",
        startsAt: new Date("2026-05-01T00:00:00.000Z"),
        endsAt: new Date("2026-07-01T00:00:00.000Z")
      });
      await repo.approve(good.id);

      const pending = await repo.create({
        storeId: store.id,
        title: "Pending",
        imageUrl: "https://example.com/pending.jpg",
        startsAt: new Date("2026-05-01T00:00:00.000Z"),
        endsAt: new Date("2026-07-01T00:00:00.000Z")
      });
      const outOfWindow = await repo.create({
        storeId: store.id,
        title: "Expired",
        imageUrl: "https://example.com/expired.jpg",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-02-01T00:00:00.000Z")
      });
      await repo.approve(outOfWindow.id);

      const inactive = await repo.create({
        storeId: store.id,
        title: "Inactive",
        imageUrl: "https://example.com/inactive.jpg",
        startsAt: new Date("2026-05-01T00:00:00.000Z"),
        endsAt: new Date("2026-07-01T00:00:00.000Z")
      });
      await repo.approve(inactive.id);
      await repo.deactivate(inactive.id);

      const list = await repo.findActive(now);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(good.id);
      expect(list.find((x) => x.id === pending.id)).toBeUndefined();
    });
  });

  describe("approve", () => {
    it("marks ad approved", async () => {
      const ad = await repo.create({
        storeId: store.id,
        title: "Approve Me",
        imageUrl: "https://example.com/ad.jpg",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.000Z")
      });
      const approved = await repo.approve(ad.id);
      expect(approved.isApproved).toBe(true);
    });

    it("throws NotFoundError when ad does not exist", async () => {
      await expect(repo.approve("nonexistent_cuid_xyz")).rejects.toThrow(NotFoundError);
    });
  });

  describe("deactivate", () => {
    it("marks ad inactive", async () => {
      const ad = await repo.create({
        storeId: store.id,
        title: "Deactivate Me",
        imageUrl: "https://example.com/ad.jpg",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.000Z")
      });
      const inactive = await repo.deactivate(ad.id);
      expect(inactive.isActive).toBe(false);
    });

    it("throws NotFoundError when ad does not exist", async () => {
      await expect(repo.deactivate("nonexistent_cuid_xyz")).rejects.toThrow(NotFoundError);
    });
  });

  describe("security", () => {
    it("treats SQL-like title as plain text", async () => {
      const malicious = "Ad'; DROP TABLE \"Advertisement\";--";
      const ad = await repo.create({
        storeId: store.id,
        title: malicious,
        imageUrl: "https://example.com/ad.jpg",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.000Z")
      });
      const byId = await db.advertisement.findUnique({ where: { id: ad.id } });
      expect(byId?.title).toBe(malicious);
      expect(await db.advertisement.count()).toBeGreaterThanOrEqual(1);
    });
  });
});