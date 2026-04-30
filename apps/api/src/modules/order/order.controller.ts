/* eslint-disable simple-import-sort/imports */
import { NotFoundError, UnauthorizedError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";

import type { BuyerCheckoutService } from "./buyer-checkout.service.js";
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
  discount: { amount: string; code: string | null }
): Record<string, unknown> {
  return {
    createdAt: order.createdAt.toISOString(),
    deliveryFee: order.deliveryFee.toString(),
    deliveryNote: order.deliveryNote,
    id: order.id,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      price: item.price.toString(),
      productName: item.productName,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      variantLabel: item.variantLabel
    })),
    landmarkDescription: order.landmarkDescription,
    paymentMethod: order.paymentMethod,
    scheduledFor: order.scheduledFor?.toISOString() ?? null,
    status: order.status,
    discount,
    statusHistory: order.statusHistory.map((h) => ({
      changedAt: h.changedAt.toISOString(),
      changedBy: h.changedBy,
      id: h.id,
      note: h.note,
      orderId: h.orderId,
      status: h.status
    })),
    storeId: order.storeId,
    subtotal: order.subtotal.toString(),
    total: order.total.toString(),
    updatedAt: order.updatedAt.toISOString(),
    userId: order.userId
  };
}

function inferDiscountAmount(order: OrderWithRelations): string {
  const subtotalPlusDelivery = Number(order.subtotal.toString()) + Number(order.deliveryFee.toString());
  const total = Number(order.total.toString());
  return Math.max(subtotalPlusDelivery - total, 0).toFixed(2);
}

type RegisterOrderDeps = {
  buyerCheckout: BuyerCheckoutService;
  orders: OrderRepository;
  tokenVerifier: AccessTokenVerifier;
};

export function registerOrderRoutes(app: FastifyInstance, deps: RegisterOrderDeps): void {
  const preCheckout = [requireAuth(deps.tokenVerifier), requireRole(["BUYER"])];
  const orderParamsSchema = z.object({
    id: z.string().min(1)
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
      const placed = await deps.buyerCheckout.placeFromCart(buyerId, parsed);
      return success(
        request,
        reply,
        serializeOrderResponse(placed.order, {
          amount: placed.appliedDiscountAmount,
          code: placed.appliedDiscountCode
        })
      );
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
          code: null
        })
      );
    }
  );
}
