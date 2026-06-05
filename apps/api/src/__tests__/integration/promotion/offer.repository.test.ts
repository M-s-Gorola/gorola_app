import { NotFoundError } from "@gorola/shared";
import type { PrismaClient, Store } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { OfferRepository } from "../../../modules/promotion/offer.repository.js";
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

describe("OfferRepository", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const repo = new OfferRepository(db);

  let store: Store;

  beforeEach(async () => {
    await cleanPromotionGraph(db);
    store = await storeRepo.create({
      name: "Offer Store",
      description: "d",
      phone: "+911111111155",
      address: "Road"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("creates an offer", async () => {
    const offer = await repo.create({
      storeId: store.id,
      title: "New Year",
      description: "desc",
      discountType: "PERCENTAGE",
      discountValue: "10",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z")
    });
    expect(offer.storeId).toBe(store.id);
    expect(offer.isActive).toBe(true);
  });

  it("throws NotFoundError for missing store", async () => {
    await expect(
      repo.create({
        storeId: "nonexistent_cuid_xyz",
        title: "No Store",
        description: "desc",
        discountType: "FLAT",
        discountValue: "50",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.000Z")
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("finds only active offers in time window", async () => {
    const now = new Date("2026-06-10T12:00:00.000Z");
    const active = await repo.create({
      storeId: store.id,
      title: "Good",
      description: "desc",
      discountType: "PERCENTAGE",
      discountValue: "15",
      startsAt: new Date("2026-06-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-30T00:00:00.000Z")
    });
    const expired = await repo.create({
      storeId: store.id,
      title: "Expired",
      description: "desc",
      discountType: "PERCENTAGE",
      discountValue: "5",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-02-01T00:00:00.000Z")
    });
    await repo.deactivate(expired.id);

    const list = await repo.findActive(now);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(active.id);
  });

  it("deactivates offer", async () => {
    const offer = await repo.create({
      storeId: store.id,
      title: "Deactivate",
      description: "desc",
      discountType: "FLAT",
      discountValue: "20",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z")
    });

    const updated = await repo.deactivate(offer.id);
    expect(updated.isActive).toBe(false);
  });

  it("throws NotFoundError when deactivating missing offer", async () => {
    await expect(repo.deactivate("nonexistent_cuid_xyz")).rejects.toThrow(NotFoundError);
  });
});