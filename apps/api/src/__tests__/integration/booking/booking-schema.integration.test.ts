import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma,getPrismaClient } from "../../../lib/prisma.js";

async function cleanDatabase(db: PrismaClient): Promise<void> {
  // Delete in reverse order of relationships
  await db.bookingOrder.deleteMany().catch(() => {});
  await db.orderStatusHistory.deleteMany().catch(() => {});
  await db.orderItem.deleteMany().catch(() => {});
  await db.order.deleteMany().catch(() => {});
  await db.productVariant.deleteMany().catch(() => {});
  await db.product.deleteMany().catch(() => {});
  await db.subCategory.deleteMany().catch(() => {});
  await db.category.deleteMany().catch(() => {});
  await db.storeOwner.deleteMany().catch(() => {});
  await db.store.deleteMany().catch(() => {});
  await db.user.deleteMany().catch(() => {});
}

describe("Booking Schema Integration", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("can successfully save a Store with storeType = BOOKING_COMMERCE", async () => {
    const store = await db.store.create({
      data: {
        name: "GoRola Test Bookings 71",
        description: "Medical tests and repairs store",
        phone: "+919999997102",
        address: "Dehradun Road, Mussoorie",
        storeType: "BOOKING_COMMERCE",
        bookingLeadDays: 1,
        isAcceptingBookings: true
      }
    });

    expect(store.id).toBeTruthy();
    expect(store.storeType).toBe("BOOKING_COMMERCE");
    expect(store.bookingLeadDays).toBe(1);
    expect(store.isAcceptingBookings).toBe(true);
  });

  it("can successfully save a ProductVariant with allowedTimeslots and requiresFasting", async () => {
    const store = await db.store.create({
      data: {
        name: "Test Store 71",
        description: "Desc",
        phone: "+919999997103",
        address: "Addr",
      }
    });

    const category = await db.category.create({
      data: {
        slug: "test-category-71",
        name: "Test Category 71",
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "test-sub-71",
        name: "Test Sub 71",
        categoryId: category.id
      }
    });

    const product = await db.product.create({
      data: {
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "Test Product 71",
        description: "Desc",
        imageUrl: "http://example.com/image.jpg",
      }
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Blood Sugar Test 71",
        price: new Decimal(150.00),
        unit: "Test",
        requiresFasting: true,
        allowedTimeslots: ["06:00-09:00", "09:00-12:00"]
      }
    });

    expect(variant.id).toBeTruthy();
    expect(variant.requiresFasting).toBe(true);
    expect(variant.allowedTimeslots).toEqual(["06:00-09:00", "09:00-12:00"]);
  });

  it("can successfully save OrderStatus.PENDING_APPROVAL and APPROVED", async () => {
    const user = await db.user.create({
      data: {
        phone: "+919999997100",
        name: "Test User 71",
      }
    });

    const store = await db.store.create({
      data: {
        name: "Test Store 2 71",
        description: "Desc",
        phone: "+919999997104",
        address: "Addr",
      }
    });

    const orderPending = await db.order.create({
      data: {
        userId: user.id,
        storeId: store.id,
        status: "PENDING_APPROVAL",
        subtotal: new Decimal(100.00),
        deliveryFee: new Decimal(10.00),
        total: new Decimal(110.00),
        paymentMethod: "COD",
        landmarkDescription: "Near Clock Tower"
      }
    });

    const orderApproved = await db.order.create({
      data: {
        userId: user.id,
        storeId: store.id,
        status: "APPROVED",
        subtotal: new Decimal(100.00),
        deliveryFee: new Decimal(10.00),
        total: new Decimal(110.00),
        paymentMethod: "COD",
        landmarkDescription: "Near Clock Tower"
      }
    });

    expect(orderPending.status).toBe("PENDING_APPROVAL");
    expect(orderApproved.status).toBe("APPROVED");
  });

  it("can successfully save a BookingOrder linked to an Order", async () => {
    const user = await db.user.create({
      data: {
        phone: "+919999997101",
        name: "Test User 2 71",
      }
    });

    const store = await db.store.create({
      data: {
        name: "Test Store 3 71",
        description: "Desc",
        phone: "+919999997105",
        address: "Addr",
      }
    });

    const order = await db.order.create({
      data: {
        userId: user.id,
        storeId: store.id,
        subtotal: new Decimal(200.00),
        deliveryFee: new Decimal(20.00),
        total: new Decimal(220.00),
        paymentMethod: "COD",
        landmarkDescription: "Near Mall Road"
      }
    });

    const bookingOrder = await db.bookingOrder.create({
      data: {
        orderId: order.id,
        scheduledDate: new Date("2026-05-20T08:00:00.000Z"),
        timeslot: "06:00-09:00",
        requiresFasting: true,
        approvalStatus: "PENDING_APPROVAL"
      }
    });

    expect(bookingOrder.id).toBeTruthy();
    expect(bookingOrder.orderId).toBe(order.id);
    expect(bookingOrder.timeslot).toBe("06:00-09:00");
    expect(bookingOrder.requiresFasting).toBe(true);
    expect(bookingOrder.approvalStatus).toBe("PENDING_APPROVAL");
  });
});
