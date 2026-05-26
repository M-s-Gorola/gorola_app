/* eslint-disable simple-import-sort/imports */
import { ValidationError } from "@gorola/shared";
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";

import { AdvertisementRepository } from "./advertisement.repository.js";
import { DiscountRepository } from "./discount.repository.js";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

const validateDiscountSchema = z.object({
  code: z.string().min(1, "Discount code is required"),
  subtotal: z.coerce.number().min(0, "Subtotal must be non-negative")
});

function getRequestId(request: FastifyRequest, reply: FastifyReply): string {
  return reply.getHeader("x-request-id")?.toString() ?? request.id;
}

function success<T>(request: FastifyRequest, reply: FastifyReply, data: T): SuccessEnvelope<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: getRequestId(request, reply)
    }
  };
}

export function registerPromotionRoutes(
  app: FastifyInstance,
  deps?: { tokenVerifier: AccessTokenVerifier }
): void {
  const discountRepo = new DiscountRepository(getPrismaClient());
  const adRepo = new AdvertisementRepository(getPrismaClient());

  app.get("/api/v1/promotions/advertisements", async (request, reply) => {
    const ads = await adRepo.findActive();

    const serializedAds = ads.map((ad) => ({
      id: ad.id,
      title: ad.title,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl
    }));

    return success(request, reply, serializedAds);
  });

  const getOffersPreHandler = deps ? { preHandler: requireAuth(deps.tokenVerifier) } : {};

  app.get("/api/v1/promotions/store/:storeId/offers", getOffersPreHandler, async (request, reply) => {
    const params = request.params as { storeId: string };
    const offers = await getPrismaClient().offer.findMany({
      where: { storeId: params.storeId },
      orderBy: { createdAt: "desc" }
    });
    const serializedOffers = offers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      discountType: offer.discountType,
      discountValue: Number(offer.discountValue),
      minOrderAmount: offer.minOrderAmount === null ? null : Number(offer.minOrderAmount),
      maxDiscount: offer.maxDiscount === null ? null : Number(offer.maxDiscount),
      startsAt: offer.startsAt.toISOString(),
      endsAt: offer.endsAt.toISOString(),
      isActive: offer.isActive
    }));
    return success(request, reply, serializedOffers);
  });

  app.post("/api/v1/promotions/discounts/validate", async (request, reply) => {
    const parsed = validateDiscountSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid discount validation payload", parsed.error.flatten());
    }

    const code = parsed.data.code.trim().toUpperCase();
    const subtotal = parsed.data.subtotal;
    const discount = await discountRepo.findActiveByCode(code);
    if (discount === null) {
      return success(request, reply, { valid: false as const });
    }
    if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
      return success(request, reply, { valid: false as const });
    }
    const minOrderAmount = discount.minOrderAmount === null ? null : Number(discount.minOrderAmount);
    if (minOrderAmount !== null && subtotal < minOrderAmount) {
      return success(request, reply, { valid: false as const });
    }

    const discountValue = Number(discount.discountValue);
    const amountSaved =
      discount.discountType === "PERCENTAGE"
        ? Number(((subtotal * discountValue) / 100).toFixed(2))
        : Number(discountValue.toFixed(2));

    return success(request, reply, {
      amountSaved: Math.max(0, Math.min(subtotal, amountSaved)),
      code,
      valid: true as const
    });
  });
}
