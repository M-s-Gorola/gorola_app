import { ValidationError } from "@gorola/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const proxyQuerySchema = z.object({
  url: z.string().url("Invalid image URL")
});

export function registerMediaRoutes(app: FastifyInstance): void {
  app.get("/api/v1/media/proxy", async (request, reply) => {
    const parsed = proxyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid image URL query parameter", parsed.error.flatten());
    }

    const { url } = parsed.data;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Gorola-Media-Proxy/1.0",
          Accept: "image/*,*/*"
        }
      });

      if (!response.ok) {
        return reply.code(response.status).send({
          success: false,
          error: `Media target returned status ${response.status}`
        });
      }

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());

      reply.header("Cache-Control", "public, max-age=604800");
      reply.header("Content-Type", contentType);
      return reply.send(buffer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to proxy media request";
      return reply.code(502).send({
        success: false,
        error: message
      });
    }
  });
}
