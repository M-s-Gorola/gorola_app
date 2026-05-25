import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import type { BookingOrderService } from "./booking-order.service.js";

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

function parseSafe<T>(schema: z.Schema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.flatten());
  }
  return result.data;
}

interface BookingOrderWithRelations {
  scheduledDate: Date;
  timeslot: string;
  requiresFasting: boolean;
  approvalStatus: string;
  rejectionReason: string | null;
  approvedAt: Date | null;
  approvedByOwnerId: string | null;
  order: {
    id: string;
    storeId: string;
    userId: string;
    status: string;
    subtotal: { toString: () => string };
    deliveryFee: { toString: () => string };
    total: { toString: () => string };
    createdAt: Date;
    updatedAt: Date;
    landmarkDescription: string;
    flatRoom: string | null;
    addressLabel: string | null;
    store: {
      id: string;
      name: string;
      phone: string;
      storeType: string;
    };
    user: {
      phone: string;
      name: string;
    } | null;
    items: Array<{
      id: string;
      orderId: string;
      productVariantId: string;
      productName: string;
      variantLabel: string;
      price: { toString: () => string };
      quantity: number;
    }>;
    statusHistory: Array<{
      id: string;
      orderId: string;
      status: string;
      changedAt: Date;
      changedBy: string;
      note: string | null;
    }>;
  };
}

function maskPhone(phone: string): string {
  if (!phone) return "";
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

function serializeBookingOrder(booking: BookingOrderWithRelations): Record<string, unknown> {
  const order = booking.order;
  return {
    id: order.id,
    storeId: order.storeId,
    userId: order.userId,
    status: booking.approvalStatus,
    subtotal: order.subtotal.toString(),
    deliveryFee: order.deliveryFee.toString(),
    total: order.total.toString(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    landmarkDescription: order.landmarkDescription,
    flatRoom: order.flatRoom,
    addressLabel: order.addressLabel,
    buyerMaskedPhone: order.user ? maskPhone(order.user.phone) : "",
    paymentMethod: "COD",
    store: {
      id: order.store.id,
      name: order.store.name,
      phone: order.store.phone,
      storeType: order.store.storeType
    },
    items: order.items.map((i) => ({
      id: i.id,
      orderId: i.orderId,
      productVariantId: i.productVariantId,
      productName: i.productName,
      variantLabel: i.variantLabel,
      price: i.price.toString(),
      quantity: i.quantity
    })),
    statusHistory: order.statusHistory.map((sh) => ({
      id: sh.id,
      orderId: sh.orderId,
      status: sh.status,
      changedAt: sh.changedAt.toISOString(),
      changedBy: sh.changedBy,
      note: sh.note
    })),
    bookingOrder: {
      scheduledDate: booking.scheduledDate.toISOString(),
      timeslot: booking.timeslot,
      requiresFasting: booking.requiresFasting,
      approvalStatus: booking.approvalStatus,
      rejectionReason: booking.rejectionReason,
      approvedAt: booking.approvedAt?.toISOString() ?? null,
      approvedByOwnerId: booking.approvedByOwnerId
    }
  };
}

type RegisterBookingDeps = {
  bookingService: BookingOrderService;
  tokenVerifier: AccessTokenVerifier;
};

export function registerBookingRoutes(app: FastifyInstance, deps: RegisterBookingDeps): void {
  const buyerPreHandlers = [requireAuth(deps.tokenVerifier), requireRole(["BUYER"])];
  const ownerPreHandlers = [requireAuth(deps.tokenVerifier), requireRole(["STORE_OWNER"])];

  const placeBookingBodySchema = z.object({
    storeId: z.string().min(1),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          variantId: z.string().min(1),
          quantity: z.number().optional()
        })
      )
      .min(1),
    scheduledDate: z.string().datetime(),
    timeslot: z.string().min(1),
    addressId: z.string().min(1)
  });

  const queryBookingsSchema = z.object({
    status: z.enum(["PENDING_APPROVAL", "APPROVED", "REJECTED", "ALL"]).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10)
  });

  const rejectBodySchema = z.object({
    reason: z.string().min(1)
  });

  const orderParamsSchema = z.object({
    orderId: z.string().min(1)
  });

  // POST /api/v1/bookings
  app.post(
    "/api/v1/bookings",
    { preHandler: buyerPreHandlers },
    async (request, reply) => {
      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Buyer subject missing");
      }

      const body = parseSafe(placeBookingBodySchema, request.body);
      const scheduledDate = new Date(body.scheduledDate);

      const placedOrder = await deps.bookingService.placeBookingRequest(
        buyerId,
        body.storeId,
        body.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          ...(i.quantity !== undefined ? { quantity: i.quantity } : {})
        })),
        {
          scheduledDate,
          timeslot: body.timeslot,
          addressId: body.addressId
        }
      );

      const bookingOrderRecord = await deps.bookingService.repository.findById(placedOrder.id);
      if (!bookingOrderRecord) {
        throw new NotFoundError("Booking order not found after transactional placement");
      }

      reply.status(201);
      return success(request, reply, {
        orderId: placedOrder.id,
        status: placedOrder.status,
        bookingOrder: {
          scheduledDate: bookingOrderRecord.scheduledDate.toISOString(),
          timeslot: bookingOrderRecord.timeslot,
          requiresFasting: bookingOrderRecord.requiresFasting
        }
      });
    }
  );

  // GET /api/v1/store/bookings
  app.get(
    "/api/v1/store/bookings",
    { preHandler: ownerPreHandlers },
    async (request, reply) => {
      const ownerId = request.user?.sub;
      if (!ownerId) {
        throw new UnauthorizedError("Store owner subject missing");
      }

      const prisma = getPrismaClient();
      const owner = await prisma.storeOwner.findUnique({
        where: { id: ownerId }
      });
      if (!owner) {
        throw new ForbiddenError("Store owner record not found");
      }

      const query = parseSafe(queryBookingsSchema, request.query);
      const statusFilter = query.status === "ALL" ? undefined : query.status;

      const result = await deps.bookingService.repository.findByStoreId(owner.storeId, {
        ...(statusFilter ? { status: statusFilter } : {}),
        page: query.page,
        limit: query.limit
      });

      return success(request, reply, {
        bookings: result.items.map((b) => serializeBookingOrder(b)),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      });
    }
  );

  // PUT /api/v1/store/bookings/:orderId/approve
  app.put(
    "/api/v1/store/bookings/:orderId/approve",
    { preHandler: ownerPreHandlers },
    async (request, reply) => {
      const ownerId = request.user?.sub;
      if (!ownerId) {
        throw new UnauthorizedError("Store owner subject missing");
      }

      const prisma = getPrismaClient();
      const owner = await prisma.storeOwner.findUnique({
        where: { id: ownerId }
      });
      if (!owner) {
        throw new ForbiddenError("Store owner record not found");
      }

      const params = parseSafe(orderParamsSchema, request.params);
      await deps.bookingService.approveBooking(owner.storeId, params.orderId, ownerId);

      const booking = await deps.bookingService.repository.findById(params.orderId);
      if (!booking) {
        throw new NotFoundError("Booking order not found");
      }

      return success(request, reply, serializeBookingOrder(booking));
    }
  );

  // PUT /api/v1/store/bookings/:orderId/reject
  app.put(
    "/api/v1/store/bookings/:orderId/reject",
    { preHandler: ownerPreHandlers },
    async (request, reply) => {
      const ownerId = request.user?.sub;
      if (!ownerId) {
        throw new UnauthorizedError("Store owner subject missing");
      }

      const prisma = getPrismaClient();
      const owner = await prisma.storeOwner.findUnique({
        where: { id: ownerId }
      });
      if (!owner) {
        throw new ForbiddenError("Store owner record not found");
      }

      const params = parseSafe(orderParamsSchema, request.params);
      const body = parseSafe(rejectBodySchema, request.body);

      await deps.bookingService.rejectBooking(
        owner.storeId,
        params.orderId,
        ownerId,
        body.reason
      );

      const booking = await deps.bookingService.repository.findById(params.orderId);
      if (!booking) {
        throw new NotFoundError("Booking order not found");
      }

      return success(request, reply, serializeBookingOrder(booking));
    }
  );

  // PUT /api/v1/store/bookings/:orderId/complete
  app.put(
    "/api/v1/store/bookings/:orderId/complete",
    { preHandler: ownerPreHandlers },
    async (request, reply) => {
      const ownerId = request.user?.sub;
      if (!ownerId) {
        throw new UnauthorizedError("Store owner subject missing");
      }

      const prisma = getPrismaClient();
      const owner = await prisma.storeOwner.findUnique({
        where: { id: ownerId }
      });
      if (!owner) {
        throw new ForbiddenError("Store owner record not found");
      }

      const params = parseSafe(orderParamsSchema, request.params);
      await deps.bookingService.completeBooking(
        owner.storeId,
        params.orderId,
        ownerId
      );

      const booking = await deps.bookingService.repository.findById(params.orderId);
      if (!booking) {
        throw new NotFoundError("Booking order not found");
      }

      return success(request, reply, serializeBookingOrder(booking));
    }
  );

  // DELETE /api/v1/bookings/:orderId
  app.delete(
    "/api/v1/bookings/:orderId",
    { preHandler: buyerPreHandlers },
    async (request, reply) => {
      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Buyer subject missing");
      }

      const params = parseSafe(orderParamsSchema, request.params);
      await deps.bookingService.cancelBookingByBuyer(buyerId, params.orderId);

      const booking = await deps.bookingService.repository.findById(params.orderId);
      if (!booking) {
        throw new NotFoundError("Booking order not found");
      }

      return success(request, reply, serializeBookingOrder(booking));
    }
  );

  // GET /api/v1/bookings/:orderId
  app.get(
    "/api/v1/bookings/:orderId",
    { preHandler: buyerPreHandlers },
    async (request, reply) => {
      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Buyer subject missing");
      }

      const params = parseSafe(orderParamsSchema, request.params);
      const booking = await deps.bookingService.repository.findById(params.orderId);
      if (!booking || booking.order.userId !== buyerId) {
        throw new NotFoundError("Booking order not found");
      }

      return success(request, reply, serializeBookingOrder(booking));
    }
  );
}
