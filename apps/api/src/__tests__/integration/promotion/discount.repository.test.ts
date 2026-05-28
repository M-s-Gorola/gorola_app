import { NotFoundError } from "@gorola/shared";
import type { PrismaClient, Store } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { DiscountRepository } from "../../../modules/promotion/discount.repository.js";
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

describe("DiscountRepository", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const repo = new DiscountRepository(db);

  let store: Store;

  beforeEach(async () => {
    await cleanPromotionGraph(db);
    store = await storeRepo.create({
      name: "Discount Store",
      description: "d",
      phone: "+911111111144",
      address: "Road"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("creates a store-bound discount code", async () => {
    const d = await repo.create({
      storeId: store.id,
      code: "SAVE10",
      discountType: "PERCENTAGE",
      discountValue: "10",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z")
    });
    expect(d.code).toBe("SAVE10");
    expect(d.usedCount).toBe(0);
  });

  it("throws NotFoundError when storeId is invalid", async () => {
    await expect(
      repo.create({
        storeId: "nonexistent_cuid_xyz",
        code: "X",
        discountType: "FLAT",
        discountValue: "20",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.000Z")
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("finds active code by code and date", async () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    const d = await repo.create({
      storeId: store.id,
      code: "ACTIVE",
      discountType: "PERCENTAGE",
      discountValue: "5",
      startsAt: new Date("2026-03-01T00:00:00.000Z"),
      endsAt: new Date("2026-03-20T00:00:00.000Z")
    });

    const found = await repo.findActiveByCode("ACTIVE", store.id, now);
    expect(found?.id).toBe(d.id);
  });

  it("returns null for inactive/expired code", async () => {
    await repo.create({
      storeId: store.id,
      code: "OLD",
      discountType: "PERCENTAGE",
      discountValue: "5",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-01-20T00:00:00.000Z")
    });

    const found = await repo.findActiveByCode("OLD", store.id, new Date("2026-03-01T00:00:00.000Z"));
    expect(found).toBeNull();
  });

  it("increments usedCount", async () => {
    const d = await repo.create({
      storeId: store.id,
      code: "COUNTME",
      discountType: "FLAT",
      discountValue: "30",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z")
    });

    const updated = await repo.incrementUsedCount(d.id);
    expect(updated.usedCount).toBe(1);
  });

  it("throws NotFoundError when incrementing missing discount", async () => {
    await expect(repo.incrementUsedCount("nonexistent_cuid_xyz")).rejects.toThrow(NotFoundError);
  });
});