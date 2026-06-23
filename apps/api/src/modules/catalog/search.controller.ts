import { ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";
import { SearchRepository } from "./search.repository.js";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

const searchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(5)
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

export function registerSearchRoutes(app: FastifyInstance): void {
  const searchRepo = new SearchRepository(getPrismaClient());

  app.get("/api/v1/search", async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid search query", parsed.error.flatten());
    }

    const data = await searchRepo.searchGlobally(parsed.data.q, parsed.data.limit);
    return success(request, reply, data);
  });

  app.get("/api/v1/search/suggestions", async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid search query", parsed.error.flatten());
    }

    const rawData = await searchRepo.getSearchSuggestions(parsed.data.q, parsed.data.limit);

    const suggestions: Array<{
      id: string;
      name: string;
      type: "category" | "subcategory" | "product" | "service";
      redirectUrl: string;
    }> = [];

    for (const cat of rawData.categories) {
      suggestions.push({
        id: cat.id,
        name: cat.name,
        type: "category",
        redirectUrl: `/categories/${cat.slug}`
      });
    }

    for (const sub of rawData.subcategories) {
      suggestions.push({
        id: sub.id,
        name: sub.name,
        type: "subcategory",
        redirectUrl: `/categories/${sub.category.slug}/${sub.slug}`
      });
    }

    for (const prod of rawData.products) {
      const isService = prod.store?.storeType === "BOOKING_COMMERCE";
      suggestions.push({
        id: prod.id,
        name: prod.name,
        type: isService ? "service" : "product",
        redirectUrl: `/products/${prod.id}`
      });
    }

    return success(request, reply, suggestions);
  });
}
