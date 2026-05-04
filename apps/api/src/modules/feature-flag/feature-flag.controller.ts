import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { FeatureFlagService } from "./feature-flag.service.js";

export class FeatureFlagController {
  public constructor(private readonly service: FeatureFlagService) {}

  /**
   * GET /api/v1/feature-flags/:key
   */
  public async getByKey(
    request: FastifyRequest<{ Params: { key: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { key } = request.params;
    const value = await this.service.getFlagValue(key);

    return reply.send({
      success: true,
      data: { key, value }
    });
  }
}

export function registerFeatureFlagRoutes(
  app: FastifyInstance,
  options: { service: FeatureFlagService }
): void {
  const controller = new FeatureFlagController(options.service);

  app.get("/api/v1/feature-flags/:key", (req, reply) =>
    controller.getByKey(req as FastifyRequest<{ Params: { key: string } }>, reply)
  );
}
