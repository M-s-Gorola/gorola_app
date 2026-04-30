/* eslint-disable import/order -- conflicting grouping rules for relative imports */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { getPrismaClient } from "../../lib/prisma.js";
import { CategoryRepository } from "./category.repository.js";

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

export function registerCategoryRoutes(app: FastifyInstance): void {
  void app;
  const categoryRepo = new CategoryRepository(getPrismaClient());

  app.get("/api/v1/categories", async (request, reply) => {
    const categories = await categoryRepo.findAllForBuyer();
    return success(request, reply, categories);
  });
}
