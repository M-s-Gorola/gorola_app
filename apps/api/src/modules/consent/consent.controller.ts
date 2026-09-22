import { UnauthorizedError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import { recordConsentBodySchema, withdrawConsentParamsSchema } from "./consent.schema.js";
import type { ConsentService } from "./consent.service.js";

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
    data,
    meta: {
      requestId: getRequestId(request, reply)
    },
    success: true
  };
}

export type RegisterConsentDeps = {
  consentService: ConsentService;
  tokenVerifier: AccessTokenVerifier;
};

export function registerConsentRoutes(app: FastifyInstance, deps: RegisterConsentDeps): void {
  const buyerGuard = [requireAuth(deps.tokenVerifier), requireRole(["BUYER"])];

  // POST /api/v1/consent - Record consent
  app.post(
    "/api/v1/consent",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const body = recordConsentBodySchema.parse(request.body);
      const ipAddress =
        (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        request.ip ??
        "127.0.0.1";
      const userAgent = (request.headers["user-agent"] as string) ?? "unknown";

      const record = await deps.consentService.recordConsent({
        consentVersion: body.consentVersion,
        ipAddress,
        noticeText: body.noticeText,
        purpose: body.purpose,
        userAgent,
        userId
      });

      reply.status(201);
      return success(request, reply, record);
    }
  );

  // GET /api/v1/consent - List all user consents
  app.get(
    "/api/v1/consent",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const consents = await deps.consentService.getUserConsents(userId);
      return success(request, reply, { consents });
    }
  );

  // DELETE /api/v1/consent/:purpose - Withdraw non-essential consent
  app.delete(
    "/api/v1/consent/:purpose",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const params = withdrawConsentParamsSchema.parse(request.params);
      const ipAddress =
        (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        request.ip ??
        "127.0.0.1";
      const userAgent = (request.headers["user-agent"] as string) ?? "unknown";

      const consent = await deps.consentService.withdrawConsent({
        ipAddress,
        purpose: params.purpose,
        userAgent,
        userId
      });

      return success(request, reply, { consent });
    }
  );
}
