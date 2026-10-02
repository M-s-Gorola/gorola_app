/* eslint-disable simple-import-sort/imports */
import { UnauthorizedError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import type { UserRepository } from "./user.repository.js";
import { parseUpdateNomineeInput, parseUpdateProfileInput } from "./user.schema.js";

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

export type RegisterUserDeps = {
  userRepository: UserRepository;
  tokenVerifier: AccessTokenVerifier;
};

export function registerUserRoutes(app: FastifyInstance, deps: RegisterUserDeps): void {
  const buyerGuard = [requireAuth(deps.tokenVerifier), requireRole(["BUYER"])];

  app.put(
    "/api/v1/account/profile",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const payload = parseUpdateProfileInput(request.body);
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const updated = await deps.userRepository.update(userId, { name: payload.name });

      return success(request, reply, {
        id: updated.id,
        name: updated.name,
        phone: updated.phone
      });
    }
  );

  // GET /api/v1/user/my-data - DPDP Act 2023 Section 11 (Right to Access & Data Portability)
  app.get(
    "/api/v1/user/my-data",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const myData = await deps.userRepository.getMyData(userId);
      return success(request, reply, myData);
    }
  );

  // PUT /api/v1/user/nominee - DPDP Act 2023 Section 14 (Right to Nominate)
  app.put(
    "/api/v1/user/nominee",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const payload = parseUpdateNomineeInput(request.body);
      const updated = await deps.userRepository.updateNominee(userId, payload);
      return success(request, reply, updated);
    }
  );

  // GET /api/v1/user/nominee - Retrieve current nominee details
  app.get(
    "/api/v1/user/nominee",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const nominee = await deps.userRepository.getNominee(userId);
      return success(request, reply, nominee);
    }
  );

  // DELETE /api/v1/user/account - DPDP Act 2023 Section 12 (Right to Erasure with 30-Day Recovery Grace Period)
  app.delete(
    "/api/v1/user/account",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const result = await deps.userRepository.markPendingDeletion(userId);
      return success(request, reply, {
        isPendingDeletion: true,
        deletionScheduledFor: result.deletionScheduledFor,
        message: "Your account has been scheduled for deletion. You have a 30-day grace period to log back in and reactivate your account."
      });
    }
  );

  // POST /api/v1/user/reactivate-account - Restore soft-deleted account within 30-day grace period
  app.post(
    "/api/v1/user/reactivate-account",
    { preHandler: buyerGuard },
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError("User subject missing");
      }

      const user = await deps.userRepository.reactivateAccount(userId);
      return success(request, reply, {
        reactivated: true,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone
        }
      });
    }
  );
}

