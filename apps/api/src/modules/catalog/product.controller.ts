/* eslint-disable simple-import-sort/imports */
import { ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";

import { type ListProductsInput, ProductRepository } from "./product.repository.js";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

const productListQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
  storeId: z.string().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
const productDetailParamsSchema = z.object({
  id: z.string().min(1)
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

function toListProductsInput(parsed: z.infer<typeof productListQuerySchema>): ListProductsInput {
  return {
    limit: parsed.limit,
    ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
    ...(parsed.storeId !== undefined ? { storeId: parsed.storeId } : {}),
    ...(parsed.search !== undefined ? { search: parsed.search } : {}),
    ...(parsed.cursor !== undefined ? { cursor: parsed.cursor } : {})
  };
}

export function registerProductRoutes(app: FastifyInstance): void {
  const productRepo = new ProductRepository(getPrismaClient());

  app.get("/api/v1/products", async (request, reply) => {
    const parsed = productListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid product list query", parsed.error.flatten());
    }

    const data = await productRepo.listForBuyer(toListProductsInput(parsed.data));
    return success(request, reply, data);
  });

  app.get("/api/v1/products/:id", async (request, reply) => {
    const parsed = productDetailParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new ValidationError("Invalid product id", parsed.error.flatten());
    }

    const data = await productRepo.getDetailForBuyer(parsed.data.id);
    return success(request, reply, data);
  });
}
