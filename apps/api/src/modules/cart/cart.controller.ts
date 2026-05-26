/* eslint-disable simple-import-sort/imports */
import { ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";

import type { PrismaClient } from "@prisma/client";
import { type CartWithItems, CartRepository } from "./cart.repository.js";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

const addCartItemBodySchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1)
});

const updateCartItemBodySchema = z.object({
  quantity: z.coerce.number().int().min(1)
});

const cartItemParamsSchema = z.object({
  productVariantId: z.string().min(1)
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

type SerializedCartItem = {
  id: string;
  cartId: string;
  productVariantId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  productName: string;
  variantLabel: string;
  variantUnit: string;
  unitPrice: string;
};

type SerializedActiveOffer = {
  id: string;
  title: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
};

type SerializedBuyerCart =
  | {
      createdAt: string;
      id: string;
      items: SerializedCartItem[];
      updatedAt: string;
      userId: string;
      activeOffer?: SerializedActiveOffer | null;
      activeOffers?: SerializedActiveOffer[];
    }
  | {
      items: [];
      userId: string;
      activeOffer?: null;
      activeOffers?: [];
    };

function toIso(d: Date): string {
  return d.toISOString();
}

function serializeCartItem(
  item: CartWithItems["items"][number]
): SerializedCartItem {
  const v = item.productVariant;
  return {
    cartId: item.cartId,
    createdAt: toIso(item.createdAt),
    id: item.id,
    productName: v.product.name,
    productVariantId: item.productVariantId,
    quantity: item.quantity,
    unitPrice: v.price.toString(),
    updatedAt: toIso(item.updatedAt),
    variantLabel: v.label,
    variantUnit: v.unit
  };
}

async function getActiveOffersForCart(
  db: PrismaClient,
  cart: CartWithItems | null
): Promise<SerializedActiveOffer[]> {
  if (!cart || cart.items.length === 0) {
    return [];
  }
  const storeId = cart.items[0]?.productVariant.product.storeId;
  if (!storeId) {
    return [];
  }
  const now = new Date();
  const offers = await db.offer.findMany({
    where: {
      storeId,
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now }
    }
  });
  return offers.map((offer) => ({
    id: offer.id,
    title: offer.title,
    discountType: offer.discountType,
    discountValue: Number(offer.discountValue),
    minOrderAmount: offer.minOrderAmount === null ? null : Number(offer.minOrderAmount),
    maxDiscount: offer.maxDiscount === null ? null : Number(offer.maxDiscount)
  }));
}

function serializeBuyerCart(
  cart: CartWithItems | { items: []; userId: string },
  activeOffers: SerializedActiveOffer[] = []
): SerializedBuyerCart {
  if (!("id" in cart)) {
    return { items: [], userId: cart.userId, activeOffer: null, activeOffers: [] };
  }
  return {
    createdAt: toIso(cart.createdAt),
    id: cart.id,
    items: cart.items.map(serializeCartItem),
    updatedAt: toIso(cart.updatedAt),
    userId: cart.userId,
    activeOffer: activeOffers[0] ?? null,
    activeOffers
  };
}

export function registerCartRoutes(
  app: FastifyInstance,
  deps: { tokenVerifier: AccessTokenVerifier }
): void {
  const cartRepo = new CartRepository(getPrismaClient());
  const preCheckout = [requireAuth(deps.tokenVerifier), requireRole(["BUYER"])];

  app.get("/api/v1/cart", { preHandler: preCheckout }, async (request, reply) => {
    const buyerId = request.user?.sub;
    if (!buyerId) {
      throw new ValidationError("Buyer subject missing from auth context");
    }
    const cart = await cartRepo.findByUserId(buyerId);
    const activeOffers = cart === null ? [] : await getActiveOffersForCart(getPrismaClient(), cart);
    return success(
      request,
      reply,
      cart === null ? serializeBuyerCart({ items: [], userId: buyerId }) : serializeBuyerCart(cart, activeOffers)
    );
  });

  app.post("/api/v1/cart/items", { preHandler: preCheckout }, async (request, reply) => {
    const parsed = addCartItemBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid add-cart-item payload", parsed.error.flatten());
    }
    const buyerId = request.user?.sub;
    if (!buyerId) {
      throw new ValidationError("Buyer subject missing from auth context");
    }
    const cart = await cartRepo.addItem(buyerId, parsed.data.productVariantId, parsed.data.quantity);
    const activeOffers = await getActiveOffersForCart(getPrismaClient(), cart);
    return success(request, reply, serializeBuyerCart(cart, activeOffers));
  });

  app.put("/api/v1/cart/items/:productVariantId", { preHandler: preCheckout }, async (request, reply) => {
    const params = cartItemParamsSchema.safeParse(request.params);
    const body = updateCartItemBodySchema.safeParse(request.body);
    if (!params.success || !body.success) {
      throw new ValidationError("Invalid update-cart-item payload", {
        params: params.success ? undefined : params.error.flatten(),
        body: body.success ? undefined : body.error.flatten()
      });
    }
    const buyerId = request.user?.sub;
    if (!buyerId) {
      throw new ValidationError("Buyer subject missing from auth context");
    }
    const cart = await cartRepo.updateQty(buyerId, params.data.productVariantId, body.data.quantity);
    const activeOffers = await getActiveOffersForCart(getPrismaClient(), cart);
    return success(request, reply, serializeBuyerCart(cart, activeOffers));
  });

  app.delete("/api/v1/cart/items/:productVariantId", { preHandler: preCheckout }, async (request, reply) => {
    const params = cartItemParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ValidationError("Invalid remove-cart-item payload", {
        params: params.error.flatten()
      });
    }
    const buyerId = request.user?.sub;
    if (!buyerId) {
      throw new ValidationError("Buyer subject missing from auth context");
    }
    const cart = await cartRepo.removeItem(buyerId, params.data.productVariantId);
    const activeOffers = await getActiveOffersForCart(getPrismaClient(), cart);
    return success(request, reply, serializeBuyerCart(cart, activeOffers));
  });

  app.delete("/api/v1/cart", { preHandler: preCheckout }, async (request, reply) => {
    const buyerId = request.user?.sub;
    if (!buyerId) {
      throw new ValidationError("Buyer subject missing from auth context");
    }
    const cart = await cartRepo.clearCart(buyerId);
    const activeOffers = await getActiveOffersForCart(getPrismaClient(), cart);
    return success(request, reply, serializeBuyerCart(cart, activeOffers));
  });
}
