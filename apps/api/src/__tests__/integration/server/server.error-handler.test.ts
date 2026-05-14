import { afterEach, describe, expect, it } from "vitest";

import { createServer } from "../../../server.js";

describe("server error handler unknown errors", () => {
  const serversToClose: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    await Promise.all(serversToClose.map(async (server) => server.close()));
    serversToClose.length = 0;
  });

  it("formats plain Error into 500 INTERNAL_SERVER_ERROR", async () => {
    const server = createServer({
      registerRoutes: (app) => {
        app.get("/api/test-errors/plain", async () => {
          throw new Error("something broke");
        });
      }
    });
    serversToClose.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/test-errors/plain"
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "something broke"
      },
      meta: {
        requestId: expect.any(String)
      }
    });
  });

  it("formats object with code and statusCode into specified envelope", async () => {
    const server = createServer({
      registerRoutes: (app) => {
        app.get("/api/test-errors/object", async () => {
          // Simulate an error object that isn't an Error instance but has expected fields
          const err = new Error("custom");
          Object.assign(err, { code: "CUSTOM_CODE", statusCode: 422 });
          throw err;
        });
      }
    });
    serversToClose.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/test-errors/object"
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: "CUSTOM_CODE",
        message: "custom"
      },
      meta: {
        requestId: expect.any(String)
      }
    });
  });
});
