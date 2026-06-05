/* eslint-disable simple-import-sort/imports */
import {
  NotFoundError,
  UnprocessableEntityError,
  ValidationError
} from "@gorola/shared";
import { Prisma, type Discount, type PrismaClient } from "@prisma/client";

import { getLogger } from "../../lib/logger.js";
import { AddressRepository } from "../address/address.repository.js";
import type { CartRepository } from "../cart/cart.repository.js";
import { DiscountRepository } from "../promotion/discount.repository.js";

import type { PlaceBuyerOrderBody } from "./order.schema.js";
import { OrderService } from "./order.service.js";

export class BuyerCheckoutService {
  public constructor(
    private readonly db: PrismaClient,
    private readonly cartRepo: CartRepository,
    private readonly addressRepo: AddressRepository,
    private readonly orderService: OrderService,
    private readonly discountRepo: DiscountRepository
  ) {}

  private computeDiscountAmount(discount: Discount, subtotal: Prisma.Decimal): Prisma.Decimal {
    const discountValue = new Prisma.Decimal(discount.discountValue.toString());
    if (discount.discountType === "PERCENTAGE") {
      return subtotal.mul(discountValue).div(100).toDecimalPlaces(2);
    }
    return discountValue.toDecimalPlaces(2);
  }

  public async placeFromCart(userId: string, body: PlaceBuyerOrderBody, ip: string, userAgent: string) {
    const cart = await this.cartRepo.findByUserId(userId);
    if (cart === null || cart.items.length === 0) {
      throw new ValidationError("Cart is empty");
    }

    let landmarkDescription: string;
    let addressLabel: string | null = null;
    let flatRoom: string | null = null;

    if (body.addressMode === "saved") {
      const addr = await this.addressRepo.findByIdForBuyer(userId, body.addressId);
      if (addr === null) {
        throw new NotFoundError("Address not found");
      }
      landmarkDescription = addr.landmarkDescription;
      addressLabel = addr.label;
      flatRoom = addr.flatRoom;
    } else {
      landmarkDescription = body.landmarkDescription;
      addressLabel = body.addressLabel ?? null;
      flatRoom = body.flatRoom ?? null;
    }

    const variantIds = cart.items.map((i) => i.productVariantId);
    const variants = await this.db.productVariant.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            storeId: true,
            isActive: true
          }
        }
      },
      where: { id: { in: variantIds } }
    });

    const byVariantId = new Map(variants.map((v) => [v.id, v]));
    const storeIds = new Set<string>();
    for (const v of variants) {
      storeIds.add(v.product.storeId);
    }
    if (storeIds.size > 1) {
      throw new UnprocessableEntityError(
        "Checkout requires a single-store cart; remove items from other stores.",
        {
          stores: [...storeIds]
        }
      );
    }

    let subtotal = new Prisma.Decimal(0);

    const lineItems: Array<{
      price: Prisma.Decimal;
      productName: string;
      productVariantId: string;
      quantity: number;
      variantLabel: string;
    }> = [];

    for (const line of cart.items) {
      const v = byVariantId.get(line.productVariantId);
      if (!v || !v.product.isActive || !v.isActive) {
        throw new ValidationError("Cart contains inactive or missing products", {
          productVariantId: line.productVariantId
        });
      }

      subtotal = subtotal.add(v.price.mul(line.quantity));

      lineItems.push({
        price: v.price,
        productName: v.product.name,
        productVariantId: v.id,
        quantity: line.quantity,
        variantLabel: v.label
      });
    }

    const deliveryFee = new Prisma.Decimal(30);
    const storeId = [...storeIds][0]!;
    let appliedDiscountCode: string | null = null;
    let appliedDiscountAmount = new Prisma.Decimal(0);
    let discountIdToIncrement: string | null = null;

    if (typeof body.discountCode === "string" && body.discountCode.trim().length > 0) {
      const normalizedCode = body.discountCode.trim().toUpperCase();
      const discount = await this.discountRepo.findActiveByCode(normalizedCode, storeId);
      if (discount === null) {
        throw new ValidationError("Invalid or expired discount code", {
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
      appliedDiscountCode = normalizedCode;
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
      subtotal.add(deliveryFee).sub(appliedDiscountAmount).sub(appliedOfferAmount),
      new Prisma.Decimal(0)
    );

    const order = await this.orderService.placeOrderWithStock({
      changedBy: `buyer:${userId}`,
      deliveryFee: deliveryFee.toString(),
      deliveryNote: body.deliveryNote ?? null,
      items: lineItems.map((line) => ({
        price: line.price.toString(),
        productName: line.productName,
        productVariantId: line.productVariantId,
        quantity: line.quantity,
        variantLabel: line.variantLabel
      })),
      landmarkDescription,
      addressLabel,
      flatRoom,
      appliedDiscountCode,
      paymentMethod: body.paymentMethod,
      scheduledFor: null,
      storeId,
      subtotal: subtotal.toString(),
      total: total.toString(),
      userId
    });

    await this.cartRepo.clearCart(userId);

    if (discountIdToIncrement !== null) {
      try {
        await this.discountRepo.incrementUsedCount(discountIdToIncrement);
      } catch (err: unknown) {
        getLogger().warn(
          { err, discountId: discountIdToIncrement, userId },
          "incrementUsedCount failed after successful checkout — order persisted and cart cleared"
        );
      }
    }

    if (
      body.addressMode === "new" &&
      body.saveAddress === true &&
      typeof body.addressLabel === "string" &&
      body.addressLabel.length > 0
    ) {
      await this.addressRepo.create({
        flatRoom: body.flatRoom ?? null,
        label: body.addressLabel,
        landmarkDescription,
        ...(body.lat !== undefined && body.lat !== null ? { lat: body.lat } : {}),
        ...(body.lng !== undefined && body.lng !== null ? { lng: body.lng } : {}),
        userId
      });
    }

    await this.db.auditLog.create({
      data: {
        actorId: userId,
        actorRole: "BUYER",
        action: "BUYER_ORDER_CREATE",
        entityType: "Order",
        entityId: order.id,
        newValue: {
          total: total.toString(),
          itemsCount: order.items.length
        },
        ip,
        userAgent
      }
    });

    return {
      appliedDiscountAmount: appliedDiscountAmount.toFixed(2),
      appliedDiscountCode,
      appliedOfferAmount: appliedOfferAmount.toFixed(2),
      order
    };
  }
}
