import { ForbiddenError } from "@gorola/shared";
import type { Address, Category, PrismaClient, Product, ProductVariant, Store, SubCategory, User } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { BookingOrderRepository } from "../../../modules/booking/booking-order.repository.js";
import { BookingOrderService } from "../../../modules/booking/booking-order.service.js";

async function cleanDatabase(db: PrismaClient): Promise<void> {
  await db.stockMovement.deleteMany().catch(() => {});
  await db.orderStatusHistory.deleteMany().catch(() => {});
  await db.orderItem.deleteMany().catch(() => {});
  await db.bookingOrder.deleteMany().catch(() => {});
  await db.order.deleteMany().catch(() => {});
  await db.discount.deleteMany().catch(() => {});
  await db.cartItem.deleteMany().catch(() => {});
  await db.cart.deleteMany().catch(() => {});
  await db.address.deleteMany().catch(() => {});
  await db.riderLocation.deleteMany().catch(() => {});
  await db.deliveryRider.deleteMany().catch(() => {});
  await db.advertisement.deleteMany().catch(() => {});
  await db.offer.deleteMany().catch(() => {});
  await db.user.deleteMany().catch(() => {});
  await db.productVariant.deleteMany().catch(() => {});
  await db.product.deleteMany().catch(() => {});
  await db.storeOwner.deleteMany().catch(() => {});
  await db.store.deleteMany().catch(() => {});
  await db.subCategory.deleteMany().catch(() => {});
  await db.category.deleteMany().catch(() => {});
}

describe("BookingOrderService Integration", () => {
  const db = getPrismaClient();
  const repository = new BookingOrderRepository(db);
  const service = new BookingOrderService(db, repository);

  let buyerUser: User;
  let bookingStore: Store;
  let quickStore: Store;
  let category: Category;
  let subCategory: SubCategory;
  let product: Product;
  let fastingVariant: ProductVariant;
  let nonFastingVariant: ProductVariant;
  let savedAddress: Address;

  beforeEach(async () => {
    await cleanDatabase(db);

    // Create Buyer User
    buyerUser = await db.user.create({
      data: {
        phone: "+919999997200",
        name: "Buyer User 72"
      }
    });

    // Create Booking Commerce Store
    bookingStore = await db.store.create({
      data: {
        name: "Lab Diagnostics 72",
        description: "Medical tests on schedule",
        phone: "+919999997202",
        address: "Dehradun Road",
        storeType: "BOOKING_COMMERCE",
        bookingLeadDays: 1,
        isAcceptingBookings: true
      }
    });

    // Create Quick Commerce Store
    quickStore = await db.store.create({
      data: {
        name: "Grocery Supermarket 72",
        description: "Standard Quick Commerce",
        phone: "+919999997203",
        address: "Mussoorie Road",
        storeType: "QUICK_COMMERCE"
      }
    });

    // Create Category & SubCategory
    category = await db.category.create({
      data: {
        slug: "medical-tests-72",
        name: "Medical Tests 72"
      }
    });

    subCategory = await db.subCategory.create({
      data: {
        slug: "blood-tests-72",
        name: "Blood Tests 72",
        categoryId: category.id
      }
    });

    // Create Product
    product = await db.product.create({
      data: {
        storeId: bookingStore.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: "CBC & Sugar Tests 72",
        description: "Comprehensive blood tests",
        imageUrl: "http://example.com/blood.jpg"
      }
    });

    // Create Fasting Product Variant
    fastingVariant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Glucose Fasting Test 72",
        price: new Decimal(200.00),
        unit: "Test",
        requiresFasting: true,
        allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00"]
      }
    });

    // Create Non-Fasting Product Variant
    nonFastingVariant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Vitamin D Test 72",
        price: new Decimal(1000.00),
        unit: "Test",
        requiresFasting: false,
        allowedTimeslots: ["09:00-12:00", "12:00-15:00"]
      }
    });

    // Create Addresses
    savedAddress = await db.address.create({
      data: {
        userId: buyerUser.id,
        flatRoom: "Flat 101",
        label: "Home 72",
        landmarkDescription: "Near Central Mall"
      }
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("should throw validation error with code INVALID_BOOKING_DATE when scheduledDate is today", async () => {
    const today = new Date();
    await expect(
      service.placeBookingRequest(
        buyerUser.id,
        bookingStore.id,
        [{ productId: product.id, variantId: fastingVariant.id }],
        { scheduledDate: today, timeslot: "06:00-09:00", addressId: savedAddress.id }
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "INVALID_BOOKING_DATE"
      })
    );
  });

  it("should throw validation error with code INVALID_TIMESLOT_FOR_FASTING when timeslot is in afternoon and requires fasting", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await expect(
      service.placeBookingRequest(
        buyerUser.id,
        bookingStore.id,
        [{ productId: product.id, variantId: fastingVariant.id }],
        { scheduledDate: tomorrow, timeslot: "12:00-15:00", addressId: savedAddress.id }
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "INVALID_TIMESLOT_FOR_FASTING"
      })
    );
  });

  it("should throw TIMESLOT_NOT_ALLOWED when chosen timeslot is not in variant allowedTimeslots", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await expect(
      service.placeBookingRequest(
        buyerUser.id,
        bookingStore.id,
        [{ productId: product.id, variantId: nonFastingVariant.id }],
        { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "TIMESLOT_NOT_ALLOWED"
      })
    );
  });

  it("should throw INVALID_STORE_TYPE when store is QUICK_COMMERCE", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await expect(
      service.placeBookingRequest(
        buyerUser.id,
        quickStore.id,
        [{ productId: product.id, variantId: fastingVariant.id }],
        { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "INVALID_STORE_TYPE"
      })
    );
  });

  it("should throw STORE_NOT_ACCEPTING_BOOKINGS when store has isAcceptingBookings = false", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.store.update({
      where: { id: bookingStore.id },
      data: { isAcceptingBookings: false }
    });

    await expect(
      service.placeBookingRequest(
        buyerUser.id,
        bookingStore.id,
        [{ productId: product.id, variantId: fastingVariant.id }],
        { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "STORE_NOT_ACCEPTING_BOOKINGS"
      })
    );
  });

  it("should successfully place a booking request when input is valid", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await service.placeBookingRequest(
      buyerUser.id,
      bookingStore.id,
      [{ productId: product.id, variantId: fastingVariant.id }],
      { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
    );

    expect(result.id).toBeTruthy();
    expect(result.status).toBe("PENDING_APPROVAL");
    expect(result.orderType).toBe("BOOKING");

    // Check BookingOrder table row
    const booking = await db.bookingOrder.findUnique({
      where: { orderId: result.id }
    });
    expect(booking).toBeTruthy();
    expect(booking!.timeslot).toBe("06:00-09:00");
    expect(booking!.requiresFasting).toBe(true);
    expect(booking!.approvalStatus).toBe("PENDING_APPROVAL");

    // Assert zero stock updates occurred (StockMovement remains empty)
    const movements = await db.stockMovement.findMany({
      where: { productVariantId: fastingVariant.id }
    });
    expect(movements.length).toBe(0);
  });

  it("should successfully approve booking and transition order status to APPROVED", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placedOrder = await service.placeBookingRequest(
      buyerUser.id,
      bookingStore.id,
      [{ productId: product.id, variantId: fastingVariant.id }],
      { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
    );

    const approvedOrder = await service.approveBooking(
      bookingStore.id,
      placedOrder.id,
      "mock-owner-id"
    );

    expect(approvedOrder.status).toBe("APPROVED");

    const booking = await db.bookingOrder.findUnique({
      where: { orderId: placedOrder.id }
    });
    expect(booking!.approvalStatus).toBe("APPROVED");
    expect(booking!.approvedAt).toBeTruthy();
    expect(booking!.approvedByOwnerId).toBe("mock-owner-id");

    const history = await db.orderStatusHistory.findMany({
      where: { orderId: placedOrder.id },
      orderBy: { changedAt: "desc" }
    });
    expect(history[0]!.status).toBe("APPROVED");
  });

  it("should throw ForbiddenError when approveBooking is called by owner of a different store", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placedOrder = await service.placeBookingRequest(
      buyerUser.id,
      bookingStore.id,
      [{ productId: product.id, variantId: fastingVariant.id }],
      { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
    );

    await expect(
      service.approveBooking(
        quickStore.id, // wrong store ID
        placedOrder.id,
        "mock-owner-id"
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("should successfully reject booking, transition order status to CANCELLED, and record rejection reason", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placedOrder = await service.placeBookingRequest(
      buyerUser.id,
      bookingStore.id,
      [{ productId: product.id, variantId: fastingVariant.id }],
      { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
    );

    const rejectedOrder = await service.rejectBooking(
      bookingStore.id,
      placedOrder.id,
      "mock-owner-id",
      "Slot fully booked"
    );

    expect(rejectedOrder.status).toBe("CANCELLED");

    const booking = await db.bookingOrder.findUnique({
      where: { orderId: placedOrder.id }
    });
    expect(booking!.approvalStatus).toBe("REJECTED");
    expect(booking!.rejectionReason).toBe("Slot fully booked");

    const history = await db.orderStatusHistory.findMany({
      where: { orderId: placedOrder.id },
      orderBy: { changedAt: "desc" }
    });
    expect(history[0]!.status).toBe("CANCELLED");
    expect(history[0]!.note).toBe("Slot fully booked");
  });

  it("should successfully cancel booking by buyer when status is PENDING_APPROVAL", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placedOrder = await service.placeBookingRequest(
      buyerUser.id,
      bookingStore.id,
      [{ productId: product.id, variantId: fastingVariant.id }],
      { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
    );

    const cancelledOrder = await service.cancelBookingByBuyer(
      buyerUser.id,
      placedOrder.id
    );

    expect(cancelledOrder.status).toBe("CANCELLED");

    const booking = await db.bookingOrder.findUnique({
      where: { orderId: placedOrder.id }
    });
    expect(booking!.approvalStatus).toBe("CANCELLED");
  });

  it("should throw validation error with code CANNOT_CANCEL_APPROVED_BOOKING when cancelBookingByBuyer is called on an APPROVED order", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placedOrder = await service.placeBookingRequest(
      buyerUser.id,
      bookingStore.id,
      [{ productId: product.id, variantId: fastingVariant.id }],
      { scheduledDate: tomorrow, timeslot: "06:00-09:00", addressId: savedAddress.id }
    );

    await service.approveBooking(
      bookingStore.id,
      placedOrder.id,
      "mock-owner-id"
    );

    await expect(
      service.cancelBookingByBuyer(
        buyerUser.id,
        placedOrder.id
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CANNOT_CANCEL_APPROVED_BOOKING"
      })
    );
  });
});
