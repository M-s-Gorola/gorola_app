import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { disconnectPrisma } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

describe("Media Proxy API Integration Tests", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
    registerAppRoutes(server);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  it("should return HTTP 400 for invalid or missing image URL", async () => {
    const res1 = await server.inject({
      method: "GET",
      url: "/api/v1/media/proxy?url=not-a-valid-url"
    });
    expect(res1.statusCode).toBe(400);

    const res2 = await server.inject({
      method: "GET",
      url: "/api/v1/media/proxy"
    });
    expect(res2.statusCode).toBe(400);
  });

  it("should stream media response with Cache-Control headers for valid image URL", async () => {
    const targetUrl = "https://drive.google.com/file/d/1IS7IN6zTLYFnAYUTmvJApgaKlEE/view";

    // Mock global fetch for testing
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => Buffer.from("fake-image-bytes")
    } as unknown as Response);

    try {
      const res = await server.inject({
        method: "GET",
        url: `/api/v1/media/proxy?url=${encodeURIComponent(targetUrl)}`
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toBe("public, max-age=604800");
      expect(res.headers["content-type"]).toBe("image/jpeg");
      expect(res.rawPayload.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
