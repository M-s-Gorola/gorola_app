/* eslint-disable simple-import-sort/imports */
import { AppError, ValidationError } from "@gorola/shared";
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";

import { AdvertisementRepository } from "./advertisement.repository.js";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

const validateDiscountSchema = z.object({
  code: z.string().min(1, "Discount code is required"),
  subtotal: z.coerce.number().min(0, "Subtotal must be non-negative"),
  storeId: z.string().min(1, "Store ID is required")
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
      where: { storeId: params.storeId, isActive: true },
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
    const storeId = parsed.data.storeId;
    const discount = await getPrismaClient().discount.findFirst({
      where: { storeId, code }
    });
    if (discount === null) {
      return success(request, reply, { valid: false as const });
    }
    if (!discount.isActive) {
      throw new AppError("Discount is inactive", {
        code: "DISCOUNT_INACTIVE",
        statusCode: 422
      });
    }
    const now = new Date();
    if (discount.startsAt > now || discount.endsAt < now) {
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

  if (process.env.NODE_ENV === "test") {
    app.post("/api/v1/test/advertisements/:id/approve", async (request, reply) => {
      const params = request.params as { id: string };
      const approvedAd = await adRepo.approve(params.id);
      return success(request, reply, approvedAd);
    });

    app.post("/api/v1/test/store-owner/:email/reset", async (request, reply) => {
      const params = request.params as { email: string };
      const { hash } = await import("bcryptjs");
      const hashedPw = await hash("Owner#123", 10);
      
      const prisma = getPrismaClient();

      // Find the store owner to get their storeId
      const owner = await prisma.storeOwner.findFirst({
        where: { email: params.email }
      });

      if (owner) {
        // Clear all offers for this store
        await prisma.offer.deleteMany({
          where: { storeId: owner.storeId }
        });

        // Clear all discounts for this store (except standard seeded TESTDEAL10)
        await prisma.discount.deleteMany({
          where: {
            storeId: owner.storeId,
            NOT: {
              code: "TESTDEAL10"
            }
          }
        });

        // Clear all dynamic advertisements for this store
        await prisma.advertisement.deleteMany({
          where: {
            storeId: owner.storeId,
            NOT: {
              id: {
                in: ["adv_1", "adv_2", "adv_3", "adv_pending_e2e"]
              }
            }
          }
        });
      }

      // Clear all cart items to prevent cart leakage between tests/retries
      await prisma.cartItem.deleteMany({});

      await prisma.storeOwner.updateMany({
        where: { email: params.email },
        data: {
          totpEnabled: false,
          totpSecret: null,
          passwordHash: hashedPw
        }
      });
      return success(request, reply, { reset: true });
    });

    app.post("/api/v1/test/store/:id/reset-status", async (request, reply) => {
      const params = request.params as { id: string };
      await getPrismaClient().store.update({
        where: { id: params.id },
        data: {
          isAcceptingOrders: true,
          isAcceptingBookings: true
        }
      });
      return success(request, reply, { reset: true });
    });

    app.post("/api/v1/test/admin/reset", async (request, reply) => {
      const prisma = getPrismaClient();
      const { hash } = await import("bcryptjs");
      const adminPwHash = await hash("AdminGorola#123", 12);

      // 1. Reset admin
      await prisma.admin.update({
        where: { email: "admin@gorola.in" },
        data: {
          totpSecret: null,
          passwordHash: adminPwHash
        }
      });

      // 2. Reset feature flags
      await prisma.featureFlag.upsert({
        where: { key: "WEATHER_MODE_ACTIVE" },
        update: { value: false },
        create: {
          key: "WEATHER_MODE_ACTIVE",
          value: false,
          description: "System-wide weather mode toggle.",
          updatedBy: "system"
        }
      });

      // 3. Reset buyer active status
      await prisma.user.updateMany({
        where: { phone: "+919876543210" },
        data: { isActive: true }
      });

      // 4. Reset advertisements (specifically the pending ad and any other test creations)
      await prisma.advertisement.upsert({
        where: { id: "adv_pending_e2e" },
        update: {
          isApproved: false,
          isActive: true,
          title: "E2E Pending Ad",
        },
        create: {
          id: "adv_pending_e2e",
          storeId: "store_gorola_hillside_mart",
          title: "E2E Pending Ad",
          imageUrl: "https://fastly.picsum.photos/id/11/2500/1667.jpg?hmac=xxjFJtAPgshYkysU_aqx2sZir-kIOjNR9vx0te7GycQ",
          linkUrl: "/categories/groceries",
          startsAt: new Date(Date.now() - 1000 * 60 * 60),
          endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
          isApproved: false,
          isActive: true,
        },
      });
      await prisma.advertisement.deleteMany({
        where: {
          id: {
            notIn: ["adv_1", "adv_2", "adv_3", "adv_pending_e2e"]
          }
        }
      });

      // 5. Delete dynamic stores/owners
      const dynamicOwners = await prisma.storeOwner.findMany({
        where: {
          OR: [
            { email: { startsWith: "e2e_owner_" } },
            { email: { contains: "e2e_" } }
          ]
        }
      });
      const dynamicStoreIds = dynamicOwners.map((o) => o.storeId);

      // Also find stores matching "E2E" prefix in name
      const dynamicStoresByName = await prisma.store.findMany({
        where: { name: { startsWith: "E2E " } }
      });
      for (const st of dynamicStoresByName) {
        if (!dynamicStoreIds.includes(st.id)) {
          dynamicStoreIds.push(st.id);
        }
      }

      if (dynamicStoreIds.length > 0) {
        await prisma.offer.deleteMany({ where: { storeId: { in: dynamicStoreIds } } });
        await prisma.discount.deleteMany({ where: { storeId: { in: dynamicStoreIds } } });
        await prisma.stockMovement.deleteMany({
          where: { productVariant: { product: { storeId: { in: dynamicStoreIds } } } }
        });
        await prisma.productVariant.deleteMany({
          where: { product: { storeId: { in: dynamicStoreIds } } }
        });
        await prisma.product.deleteMany({ where: { storeId: { in: dynamicStoreIds } } });
        await prisma.storeOwner.deleteMany({ where: { storeId: { in: dynamicStoreIds } } });
        await prisma.store.deleteMany({ where: { id: { in: dynamicStoreIds } } });
      }

      // 6. Delete any audit logs generated during testing in the last 10 minutes
      await prisma.auditLog.deleteMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
        }
      });

      return success(request, reply, { reset: true });
    });
  }
}

