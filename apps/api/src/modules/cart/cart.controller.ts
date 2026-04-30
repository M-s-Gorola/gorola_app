/* eslint-disable simple-import-sort/imports */
import { ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";

import { CartRepository } from "./cart.repository.js";

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
    return success(request, reply, cart ?? { userId: buyerId, items: [] });
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
    return success(request, reply, cart);
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
    return success(request, reply, cart);
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
    return success(request, reply, cart);
  });

  app.delete("/api/v1/cart", { preHandler: preCheckout }, async (request, reply) => {
    const buyerId = request.user?.sub;
    if (!buyerId) {
      throw new ValidationError("Buyer subject missing from auth context");
    }
    const cart = await cartRepo.clearCart(buyerId);
    return success(request, reply, cart);
  });
}
