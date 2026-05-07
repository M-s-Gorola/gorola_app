import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createBuyerTokenService } from "../../../modules/auth/buyer-token.service.js";

describe("createBuyerTokenService", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const store = new Map<string, string>();
  const redis = {
    del: async (key: string) => Number(store.delete(key)),
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, _mode: "EX", _ttl: number) => {
      void _mode;
      void _ttl;
      store.set(key, value);
    }
  };

  it("issueTokens persists refresh opaque and verifies correctly", async () => {
    const svc = createBuyerTokenService({
      accessTtlSeconds: 60,
      privateKey,
      publicKey,
      redis,
      refreshTtlSeconds: 120
    });

    const first = await svc.issueTokens({ name: "Test User", phone: "+919900000099", userId: "u1" });
    expect(first.accessToken.length).toBeGreaterThan(20);
    expect(first.refreshToken.length).toBeGreaterThan(20);

    const payload = await svc.verifyAccessToken(first.accessToken);
    expect(payload.sub).toBe("u1");
    expect(payload.role).toBe("BUYER");

    const refreshPayload = await svc.verifyRefreshToken(first.refreshToken);
    expect(refreshPayload.userId).toBe("u1");
    expect(refreshPayload.phone).toBe("+919900000099");
    expect(refreshPayload.name).toBe("Test User");

    await svc.revokeRefreshToken(first.refreshToken);
    await expect(svc.verifyRefreshToken(first.refreshToken)).rejects.toThrow();
  });
});
