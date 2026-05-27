import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@gorola/shared";
import { type Order, Prisma, type PrismaClient } from "@prisma/client";

import { BookingOrderRepository } from "./booking-order.repository.js";

export class BookingOrderService {
  public constructor(
    private readonly db: PrismaClient,
    public readonly repository: BookingOrderRepository,
    private readonly orderEmitter?: { emitStatusChanged: (orderId: string, status: string) => void }
  ) {}

  private computeDiscountAmount(
    discount: { discountType: string; discountValue: Prisma.Decimal | number | string },
    subtotal: Prisma.Decimal
  ): Prisma.Decimal {
    const discountValue = new Prisma.Decimal(discount.discountValue.toString());
    if (discount.discountType === "PERCENTAGE") {
      return subtotal.mul(discountValue).div(100).toDecimalPlaces(2);
    }
    return discountValue.toDecimalPlaces(2);
  }

  public async placeBookingRequest(
    userId: string,
    storeId: string,
    items: Array<{ productId: string; variantId: string; quantity?: number }>,
    bookingDetails: { scheduledDate: Date; timeslot: string; addressId: string },
    discountCode?: string
  ): Promise<Order> {
    if (!items || items.length === 0) {
      throw new ValidationError("Booking order must contain at least one item.");
    }

    // 1. Validate Store
    const store = await this.db.store.findUnique({
      where: { id: storeId }
    });
    if (!store) {
      throw new NotFoundError(`Store with ID ${storeId} not found.`);
    }
    if (store.storeType !== "BOOKING_COMMERCE") {
      throw new AppError("Selected store does not support Booking Commerce.", {
        code: "INVALID_STORE_TYPE",
        statusCode: 400
      });
    }
    if (!store.isAcceptingBookings) {
      throw new AppError("Store is not accepting bookings at this time.", {
        code: "STORE_NOT_ACCEPTING_BOOKINGS",
        statusCode: 400
      });
    }

    // 2. Validate Scheduled Date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minBookingDate = new Date(today);
    minBookingDate.setDate(today.getDate() + (store.bookingLeadDays ?? 1));

    const bookingDate = new Date(bookingDetails.scheduledDate);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate.getTime() < minBookingDate.getTime()) {
      throw new AppError("Booking date is too early or in the past.", {
        code: "INVALID_BOOKING_DATE",
        statusCode: 400
      });
    }

    // 3. Validate Address
    const address = await this.db.address.findUnique({
      where: { id: bookingDetails.addressId }
    });
    if (!address) {
      throw new NotFoundError(`Address with ID ${bookingDetails.addressId} not found.`);
    }
    if (address.userId !== userId) {
      throw new ForbiddenError("You do not have permission to use this address.");
    }

    // 4. Validate Items, Timeslots and Fasting requirements
    const variantMap = new Map<
      string,
      Prisma.ProductVariantGetPayload<{ include: { product: true } }>
    >();
    let subtotal = new Prisma.Decimal(0);
    let requiresFasting = false;

    for (const item of items) {
      const variant = await this.db.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true }
      });

      if (!variant) {
        throw new NotFoundError(`Product variant with ID ${item.variantId} not found.`);
      }

      if (!variant.isActive || !variant.product.isActive) {
        throw new ValidationError("Selected product variant is inactive.");
      }

      if (variant.product.storeId !== storeId) {
        throw new ValidationError("All items in a booking must belong to the same store.");
      }

      // Validate allowed timeslot
      const isAllowed = variant.allowedTimeslots.includes(bookingDetails.timeslot);
      if (!isAllowed) {
        throw new AppError(`Timeslot '${bookingDetails.timeslot}' is not allowed for this service.`, {
          code: "TIMESLOT_NOT_ALLOWED",
          statusCode: 400
        });
      }

      // Validate fasting slot if required
      if (variant.requiresFasting) {
        requiresFasting = true;
        const parts = bookingDetails.timeslot.split("-");
        const startPart = parts[0]?.trim() || "";
        const startHour = parseInt(startPart.split(":")[0] || "12", 10);
        if (startHour >= 10) {
          throw new AppError("Fasting service requires an early morning timeslot (before 10:00 AM).", {
            code: "INVALID_TIMESLOT_FOR_FASTING",
            statusCode: 400
          });
        }
      }

      const quantity = item.quantity ?? 1;
      subtotal = subtotal.add(new Prisma.Decimal(variant.price.toString()).mul(quantity));
      variantMap.set(item.variantId, variant);
    }

    // --- Discount & Offer logic matching BuyerCheckoutService ---
    let appliedDiscountAmount = new Prisma.Decimal(0);
    let discountIdToIncrement: string | null = null;

    if (discountCode) {
      const normalizedCode = discountCode.trim().toUpperCase();
      const discount = await this.db.discount.findUnique({
        where: { code: normalizedCode }
      });

      if (!discount || !discount.isActive) {
        throw new ValidationError("Invalid or expired discount code", {
          discountCode: normalizedCode
        });
      }
      const now = new Date();
      if (discount.startsAt > now || discount.endsAt < now) {
        throw new ValidationError("Invalid or expired discount code", {
          discountCode: normalizedCode
        });
      }
      if (discount.storeId !== null && discount.storeId !== storeId) {
        throw new ValidationError("Discount code is not valid for this store", {
          discountCode: normalizedCode
        });
      }
      if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
        throw new ValidationError("Invalid or expired discount code", {
          discountCode: normalizedCode
        });
      }
      const minOrderAmount =
        discount.minOrderAmount === null ? null : new Prisma.Decimal(discount.minOrderAmount.toString());
      if (minOrderAmount !== null && subtotal.lessThan(minOrderAmount)) {
        throw new ValidationError("Discount minimum subtotal not met", {
          discountCode: normalizedCode,
          minOrderAmount: minOrderAmount.toString()
        });
      }
      appliedDiscountAmount = Prisma.Decimal.min(
        subtotal,
        this.computeDiscountAmount(discount, subtotal)
      );
      discountIdToIncrement = discount.id;
    }

    // Fetch active store-wide offers for this store
    const now = new Date();
    const activeOffers = await this.db.offer.findMany({
      where: {
        storeId,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now }
      }
    });

    let appliedOfferAmount = new Prisma.Decimal(0);
    for (const offer of activeOffers) {
      const minOrderAmount =
        offer.minOrderAmount === null ? null : new Prisma.Decimal(offer.minOrderAmount.toString());
      if (minOrderAmount === null || subtotal.greaterThanOrEqualTo(minOrderAmount)) {
        const discountValue = new Prisma.Decimal(offer.discountValue.toString());
        let currentOfferAmount = new Prisma.Decimal(0);
        if (offer.discountType === "PERCENTAGE") {
          currentOfferAmount = subtotal.mul(discountValue).div(100).toDecimalPlaces(2);
          if (offer.maxDiscount !== null) {
            const maxDiscount = new Prisma.Decimal(offer.maxDiscount.toString());
            currentOfferAmount = Prisma.Decimal.min(currentOfferAmount, maxDiscount);
          }
        } else {
          currentOfferAmount = discountValue.toDecimalPlaces(2);
        }
        currentOfferAmount = Prisma.Decimal.min(subtotal.sub(appliedOfferAmount), currentOfferAmount);
        if (currentOfferAmount.greaterThan(0)) {
          appliedOfferAmount = appliedOfferAmount.add(currentOfferAmount);
        }
      }
    }

    const total = Prisma.Decimal.max(
      subtotal.sub(appliedDiscountAmount).sub(appliedOfferAmount),
      new Prisma.Decimal(0)
    );

    // 5. Atomic database transaction to place the booking order
    const placed = await this.db.$transaction(async (tx) => {
      if (discountIdToIncrement !== null) {
        await tx.discount.update({
          where: { id: discountIdToIncrement },
          data: { usedCount: { increment: 1 } }
        });
      }

      const order = await tx.order.create({
        data: {
          userId,
          storeId,
          status: "PENDING_APPROVAL",
          orderType: "BOOKING",
          subtotal,
          deliveryFee: new Prisma.Decimal(0),
          total,
          paymentMethod: "COD",
          landmarkDescription: address.landmarkDescription,
          addressLabel: address.label,
          flatRoom: address.flatRoom,
          items: {
            create: items.map((item) => {
              const v = variantMap.get(item.variantId)!;
              return {
                productVariantId: item.variantId,
                productName: v.product.name,
                variantLabel: v.label,
                price: v.price,
                quantity: item.quantity ?? 1
              };
            })
          },
          statusHistory: {
            create: {
              status: "PENDING_APPROVAL",
              changedBy: `buyer:${userId}`,
              note: "Booking request placed"
            }
          }
        }
      });

      await tx.bookingOrder.create({
        data: {
          orderId: order.id,
          scheduledDate: bookingDetails.scheduledDate,
          timeslot: bookingDetails.timeslot,
          requiresFasting,
          approvalStatus: "PENDING_APPROVAL"
        }
      });

      return order;
    });

    this.orderEmitter?.emitStatusChanged(placed.id, "PENDING_APPROVAL");
    return placed;
  }

  public async approveBooking(
    storeId: string,
    orderId: string,
    ownerId: string
  ): Promise<Prisma.OrderGetPayload<{ include: { items: true; statusHistory: true } }>> {
    const booking = await this.repository.findById(orderId);
    if (!booking) {
      throw new NotFoundError(`Booking order with ID ${orderId} not found.`);
    }

    if (booking.order.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to approve bookings for this store.");
    }

    if (booking.order.status !== "PENDING_APPROVAL") {
      throw new ValidationError("Only bookings in PENDING_APPROVAL status can be approved.");
    }

    const approved = await this.db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "APPROVED" }
      });

      await tx.bookingOrder.update({
        where: { orderId },
        data: {
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          approvedByOwnerId: ownerId
        }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: "APPROVED",
          changedBy: `store-owner:${ownerId}`,
          note: "Booking request approved"
        }
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          statusHistory: true
        }
      });
    });

    this.orderEmitter?.emitStatusChanged(orderId, "APPROVED");
    return approved;
  }

  public async rejectBooking(
    storeId: string,
    orderId: string,
    ownerId: string,
    reason: string
  ): Promise<Prisma.OrderGetPayload<{ include: { items: true; statusHistory: true } }>> {
    const booking = await this.repository.findById(orderId);
    if (!booking) {
      throw new NotFoundError(`Booking order with ID ${orderId} not found.`);
    }

    if (booking.order.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to reject bookings for this store.");
    }

    if (booking.order.status !== "PENDING_APPROVAL") {
      throw new ValidationError("Only bookings in PENDING_APPROVAL status can be rejected.");
    }

    const rejected = await this.db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" }
      });

      await tx.bookingOrder.update({
        where: { orderId },
        data: {
          approvalStatus: "REJECTED",
          rejectionReason: reason
        }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: "CANCELLED",
          changedBy: `store-owner:${ownerId}`,
          note: reason
        }
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          statusHistory: true
        }
      });
    });

    this.orderEmitter?.emitStatusChanged(orderId, "CANCELLED");
    return rejected;
  }

  public async cancelBookingByBuyer(
    userId: string,
    orderId: string
  ): Promise<Prisma.OrderGetPayload<{ include: { items: true; statusHistory: true } }>> {
    const booking = await this.repository.findById(orderId);
    if (!booking) {
      throw new NotFoundError(`Booking order with ID ${orderId} not found.`);
    }

    if (booking.order.userId !== userId) {
      throw new ForbiddenError("You are not authorized to cancel this booking.");
    }

    if (booking.approvalStatus !== "PENDING_APPROVAL") {
      throw new AppError("Approved or already completed bookings cannot be cancelled by the buyer.", {
        code: "CANNOT_CANCEL_APPROVED_BOOKING",
        statusCode: 400
      });
    }

    const cancelled = await this.db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" }
      });

      await tx.bookingOrder.update({
        where: { orderId },
        data: {
          approvalStatus: "CANCELLED"
        }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: "CANCELLED",
          changedBy: `buyer:${userId}`,
          note: "Cancelled by buyer"
        }
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          statusHistory: true
        }
      });
    });

    this.orderEmitter?.emitStatusChanged(orderId, "CANCELLED");
    return cancelled;
  }

  public async completeBooking(
    storeId: string,
    orderId: string,
    ownerId: string
  ): Promise<Prisma.OrderGetPayload<{ include: { items: true; statusHistory: true } }>> {
    const booking = await this.repository.findById(orderId);
    if (!booking) {
      throw new NotFoundError(`Booking order with ID ${orderId} not found.`);
    }

    if (booking.order.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to complete bookings for this store.");
    }

    if (booking.order.status !== "APPROVED") {
      throw new ValidationError("Only bookings in APPROVED status can be completed.");
    }

    const completed = await this.db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "DELIVERED" }
      });

      await tx.bookingOrder.update({
        where: { orderId },
        data: {
          approvalStatus: "COMPLETED"
        }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: "DELIVERED",
          changedBy: `store-owner:${ownerId}`,
          note: "Booking service completed"
        }
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          statusHistory: true
        }
      });
    });

    this.orderEmitter?.emitStatusChanged(orderId, "DELIVERED");
    return completed;
  }
}

