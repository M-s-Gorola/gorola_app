/* eslint-disable simple-import-sort/imports */
import { NotFoundError, UnauthorizedError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getPrismaClient } from "../../lib/prisma.js";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";

import type { BuyerCheckoutService } from "./buyer-checkout.service.js";
import type { CartRepository } from "../cart/cart.repository.js";
import type { OrderRepository, OrderWithRelations } from "./order.repository.js";
import { parsePlaceBuyerOrderBody } from "./order.schema.js";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

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

function serializeOrderResponse(
  order: OrderWithRelations,
  discount: {
    amount: string;
    code: string | null;
    appliedDiscountAmount?: string;
    appliedOfferAmount?: string;
  }
): Record<string, unknown> {
  return {
    createdAt: order.createdAt.toISOString(),
    deliveryFee: order.deliveryFee.toString(),
    deliveryNote: order.deliveryNote,
    id: order.id,
    orderType: order.orderType,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      price: item.price.toString(),
      productName: item.productName,
      productVariantId: item.productVariantId,
      productId: item.productVariant?.productId ?? "",
      quantity: item.quantity,
      variantLabel: item.variantLabel
    })),
    landmarkDescription: order.landmarkDescription,
    addressLabel: order.addressLabel,
    flatRoom: order.flatRoom,
    paymentMethod: order.paymentMethod,
    scheduledFor: order.scheduledFor?.toISOString() ?? null,
    status: order.status,
    discount: {
      amount: discount.amount,
      code: discount.code,
      appliedDiscountAmount: discount.appliedDiscountAmount ?? discount.amount,
      appliedOfferAmount: discount.appliedOfferAmount ?? "0.00"
    },
    statusHistory: order.statusHistory.map((h) => ({
      changedAt: h.changedAt.toISOString(),
      changedBy: h.changedBy,
      id: h.id,
      note: h.note,
      orderId: h.orderId,
      status: h.status
    })),
    store: {
      id: order.store.id,
      name: order.store.name,
      phone: order.store.phone,
      storeType: order.store.storeType
    },
    storeId: order.storeId,
    subtotal: order.subtotal.toString(),
    total: order.total.toString(),
    updatedAt: order.updatedAt.toISOString(),
    userId: order.userId,
    rating: order.rating,
    ratingComment: order.ratingComment,
    bookingOrder: order.bookingOrder
      ? {
          id: order.bookingOrder.id,
          scheduledDate: order.bookingOrder.scheduledDate.toISOString(),
          timeslot: order.bookingOrder.timeslot,
          requiresFasting: order.bookingOrder.requiresFasting,
          approvalStatus: order.bookingOrder.approvalStatus,
          rejectionReason: order.bookingOrder.rejectionReason
        }
      : null
  };
}

function inferDiscountAmount(order: OrderWithRelations): string {
  const subtotalPlusDelivery = Number(order.subtotal.toString()) + Number(order.deliveryFee.toString());
  const total = Number(order.total.toString());
  return Math.max(subtotalPlusDelivery - total, 0).toFixed(2);
}

type RegisterOrderDeps = {
  buyerCheckout: BuyerCheckoutService;
  cart: CartRepository;
  orders: OrderRepository;
  tokenVerifier: AccessTokenVerifier;
  redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<void>;
  } | null;
};

export function registerOrderRoutes(app: FastifyInstance, deps: RegisterOrderDeps): void {
  const preCheckout = [requireAuth(deps.tokenVerifier), requireRole(["BUYER"])];
  const orderParamsSchema = z.object({
    id: z.string().min(1)
  });
  
  const rateBodySchema = z.object({
    rating: z.boolean().nullable().optional(),
    ratingComment: z.string().nullable().optional()
  });

  app.post(
    "/api/v1/orders",
    { preHandler: preCheckout },
    async (request, reply) => {
      const parsed = parsePlaceBuyerOrderBody(request.body);
      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Buyer subject missing");
      }

      const idempotencyKey = request.headers["x-idempotency-key"]?.toString();
      const cacheKey = idempotencyKey ? `idempotency:${buyerId}:${idempotencyKey}` : null;

      if (cacheKey && deps.redis) {
        const cached = await deps.redis.get(cacheKey);
        if (cached) {
          return reply.send(JSON.parse(cached));
        }
      }

      const placed = await deps.buyerCheckout.placeFromCart(buyerId, parsed);
      
      // Broadcast to the store's socket room about the brand new order placement!
      if (app.io) {
        app.io.to(`store:${placed.order.storeId}`).emit("store:new_order", {
          orderId: placed.order.id,
          storeId: placed.order.storeId
        });
      }

      const responsePayload = success(
        request,
        reply,
        serializeOrderResponse(placed.order, {
          amount: (
            Number(placed.appliedDiscountAmount) + Number(placed.appliedOfferAmount)
          ).toFixed(2),
          code: placed.appliedDiscountCode,
          appliedDiscountAmount: placed.appliedDiscountAmount,
          appliedOfferAmount: placed.appliedOfferAmount
        })
      );

      if (cacheKey && deps.redis) {
        // Cache for 24 hours
        await deps.redis.set(cacheKey, JSON.stringify(responsePayload), "EX", 86400);
      }

      return responsePayload;
    }
  );

  app.get(
    "/api/v1/orders/history",
    { preHandler: preCheckout },
    async (request, reply) => {
      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Buyer subject missing");
      }
      const orders = await deps.orders.findByUserId(buyerId);
      return success(request, reply, {
        orders: orders.map((o) =>
          serializeOrderResponse(o, { amount: inferDiscountAmount(o), code: o.appliedDiscountCode })
        )
      });
    }
  );

  app.get(
    "/api/v1/orders/:id",
    { preHandler: preCheckout },
    async (request, reply) => {
      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Buyer subject missing");
      }
      const params = orderParamsSchema.parse(request.params);
      const order = await deps.orders.findById(params.id);
      if (order === null || order.userId !== buyerId) {
        throw new NotFoundError("Order not found", { orderId: params.id });
      }
      return success(
        request,
        reply,
        serializeOrderResponse(order, {
          amount: inferDiscountAmount(order),
          code: order.appliedDiscountCode
        })
      );
    }
  );

  app.post(
    "/api/v1/orders/:id/reorder",
    { preHandler: preCheckout },
    async (request, reply) => {
      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Buyer subject missing");
      }
      const params = orderParamsSchema.parse(request.params);
      const order = await deps.orders.findById(params.id);
      if (order === null || order.userId !== buyerId) {
        throw new NotFoundError("Order not found", { orderId: params.id });
      }

      const variantIds = order.items.map((i) => i.productVariantId);
      const prisma = getPrismaClient();
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true }
      });

      const variantMap = new Map(variants.map((v) => [v.id, v]));
      let warnings: string[] = [];

      for (const item of order.items) {
        const v = variantMap.get(item.productVariantId);
        if (!v || !v.isActive || v.product.isDeleted || !v.product.isActive) {
          warnings.push("Some items were no longer available and were skipped.");
          continue;
        }

        try {
          await deps.cart.addItem(buyerId, item.productVariantId, item.quantity);
        } catch {
          warnings.push("Some items were no longer available and were skipped.");
        }
      }

      // De-duplicate warnings
      warnings = Array.from(new Set(warnings));

      return success(request, reply, { warnings });
    }
  );

  app.put(
    "/api/v1/orders/:id/rate",
    { preHandler: preCheckout },
    async (request, reply) => {
      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Buyer subject missing");
      }
      const params = orderParamsSchema.parse(request.params);
      const body = rateBodySchema.parse(request.body);

      const order = await deps.orders.findById(params.id);
      if (order === null || order.userId !== buyerId) {
        throw new NotFoundError("Order not found", { orderId: params.id });
      }

      if (order.status !== "DELIVERED") {
        return reply.status(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "Only delivered orders can be rated"
          }
        });
      }

      if (order.rating !== null) {
        return reply.status(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "Order has already been rated"
          }
        });
      }

      const updated = await deps.orders.updateRating(
        params.id,
        body.rating ?? null,
        body.ratingComment ?? null
      );

      return success(
        request,
        reply,
        serializeOrderResponse(updated, { amount: inferDiscountAmount(updated), code: updated.appliedDiscountCode })
      );
    }
  );
}
