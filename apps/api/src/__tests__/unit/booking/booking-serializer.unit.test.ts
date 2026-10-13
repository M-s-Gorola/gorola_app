import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { type BookingOrderWithRelations, serializeBookingOrder } from "../../../modules/booking/booking.controller.js";

describe("Booking Serializer Unit Tests (Phase 6.19.1)", () => {
  const baseBooking: BookingOrderWithRelations = {
    scheduledDate: new Date("2026-10-15T09:00:00.000Z"),
    timeslot: "09:00-12:00",
    requiresFasting: false,
    approvalStatus: "PENDING_APPROVAL",
    rejectionReason: null,
    approvedAt: null,
    approvedByOwnerId: null,
    order: {
      id: "ord_123",
      storeId: "store_123",
      userId: "user_123",
      status: "PENDING_APPROVAL",
      subtotal: new Prisma.Decimal("1000.00"),
      deliveryFee: new Prisma.Decimal("50.00"),
      total: new Prisma.Decimal("924.50"),
      appliedDiscountCode: "WELCOME50",
      discountSavingAmount: new Prisma.Decimal("45.50"),
      offerSavingAmount: new Prisma.Decimal("80.00"),
      appliedOfferTitle: "Diwali Special",
      deliveryNote: "Please ring the bell twice",
      createdAt: new Date("2026-10-14T10:00:00.000Z"),
      updatedAt: new Date("2026-10-14T10:00:00.000Z"),
      landmarkDescription: "Near Clock Tower",
      flatRoom: "Flat 402",
      addressLabel: "Home",
      rating: null,
      ratingComment: null,
      deliveryLat: null,
      deliveryLng: null,
      store: {
        id: "store_123",
        name: "Test Lab",
        phone: "+911234567890",
        storeType: "BOOKING_COMMERCE"
      },
      user: {
        name: "Test User",
        phone: "+919876543210"
      },
      items: [
        {
          id: "item_1",
          orderId: "ord_123",
          productVariantId: "var_1",
          productName: "CBC Test",
          variantLabel: "Standard",
          price: new Prisma.Decimal("1000.00"),
          quantity: 1
        }
      ],
      statusHistory: []
    }
  };

  it("maps Decimal discountSavingAmount and offerSavingAmount to standard numbers", () => {
    const result = serializeBookingOrder(baseBooking);

    expect(result.discountSavingAmount).toBe(45.50);
    expect(result.offerSavingAmount).toBe(80.00);
    expect(result.appliedDiscountCode).toBe("WELCOME50");
    expect(result.appliedOfferTitle).toBe("Diwali Special");
    expect(result.deliveryNote).toBe("Please ring the bell twice");
  });

  it("maps null and undefined savings to 0 and titles to null", () => {
    const bookingWithoutPromos: BookingOrderWithRelations = {
      ...baseBooking,
      order: {
        ...baseBooking.order,
        appliedDiscountCode: null,
        discountSavingAmount: null,
        offerSavingAmount: null,
        appliedOfferTitle: null,
        deliveryNote: null
      }
    };

    const result = serializeBookingOrder(bookingWithoutPromos);

    expect(result.discountSavingAmount).toBe(0);
    expect(result.offerSavingAmount).toBe(0);
    expect(result.appliedDiscountCode).toBeNull();
    expect(result.appliedOfferTitle).toBeNull();
    expect(result.deliveryNote).toBeNull();
  });
});
