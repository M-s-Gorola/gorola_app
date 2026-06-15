import { UnauthorizedError, ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import { PaymentService } from "./payment.service.js";
import type { PaymentGateway } from "./payment-gateway.interface.js";

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

export function registerPaymentRoutes(
  app: FastifyInstance,
  options: {
    paymentService: PaymentService;
    gateway: PaymentGateway;
    tokenVerifier: AccessTokenVerifier;
  }
): void {
  const { paymentService, gateway, tokenVerifier } = options;

  app.post(
    "/api/v1/payments/initiate",
    {
      preHandler: [requireAuth(tokenVerifier)]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        orderId: z.string(),
        paymentMethod: z.enum(["UPI", "CARD"])
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid payment initiation payload", parsed.error.flatten());
      }

      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Authentication required");
      }
      const result = await paymentService.initiatePayment(parsed.data.orderId, buyerId, gateway);

      return reply.send(success(request, reply, result));
    }
  );

  app.post(
    "/api/v1/payments/verify",
    {
      preHandler: [requireAuth(tokenVerifier)]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        orderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string()
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid payment verification payload", parsed.error.flatten());
      }

      const buyerId = request.user?.sub;
      if (!buyerId) {
        throw new UnauthorizedError("Authentication required");
      }
      const result = await paymentService.verifyPayment(
        parsed.data.orderId,
        buyerId,
        parsed.data.razorpayPaymentId,
        parsed.data.razorpaySignature,
        gateway
      );

      return reply.send(success(request, reply, result));
    }
  );
}
