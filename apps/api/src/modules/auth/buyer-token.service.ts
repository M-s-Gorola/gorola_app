import type { KeyObject } from "node:crypto";
import { randomBytes, randomUUID } from "node:crypto";

import { UnauthorizedError } from "@gorola/shared";
import { jwtVerify, SignJWT } from "jose";

import type {
  AccessTokenPayload,
  AuthTokenPair,
  IssueTokensInput,
  RedisLikeClient,
  TokenService
} from "./auth.types.js";

export type BuyerTokenServiceOptions = {
  accessTtlSeconds: number;
  privateKey: KeyObject;
  publicKey: KeyObject;
  redis: RedisLikeClient;
  refreshTtlSeconds: number;
};

const RT_PREFIX = "rt:";

function redisRefreshKey(rawToken: string): string {
  return `${RT_PREFIX}${rawToken}`;
}

export type BuyerJwtVerifier = {
  verifyAccessToken: (token: string) => Promise<AccessTokenPayload>;
};

export type BuyerTokenServiceFacade = TokenService & BuyerJwtVerifier;

export function createBuyerTokenService(options: BuyerTokenServiceOptions): BuyerTokenServiceFacade {
  const {
    accessTtlSeconds,
    privateKey,
    publicKey,
    redis,
    refreshTtlSeconds
  } = options;

  async function issueTokens(input: IssueTokensInput): Promise<AuthTokenPair> {
    const refreshRaw = randomBytes(32).toString("hex");
    const key = redisRefreshKey(refreshRaw);
    const stored = JSON.stringify({ phone: input.phone, userId: input.userId });
    await redis.set(key, stored, "EX", refreshTtlSeconds);

    const accessToken = await new SignJWT({
      phone: input.phone,
      role: "BUYER"
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(input.userId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${accessTtlSeconds}s`)
      .sign(privateKey);

    return {
      accessToken,
      refreshToken: refreshRaw
    };
  }

  async function rotateRefreshToken(oldRefreshRaw: string): Promise<AuthTokenPair> {
    const rtKey = redisRefreshKey(oldRefreshRaw);
    const payload = await redis.get(rtKey);
    if (payload === null || payload.length === 0) {
      throw new UnauthorizedError("Refresh token is invalid.");
    }
    await redis.del(rtKey);

    let parsed: { phone?: unknown; userId?: unknown };
    try {
      parsed = JSON.parse(payload) as { phone?: unknown; userId?: unknown };
    } catch {
      throw new UnauthorizedError("Refresh token is invalid.");
    }
    const userId = typeof parsed.userId === "string" ? parsed.userId : "";
    const phone = typeof parsed.phone === "string" ? parsed.phone : "";
    if (userId.length === 0 || phone.length === 0) {
      throw new UnauthorizedError("Refresh token is invalid.");
    }

    return issueTokens({ phone, userId });
  }

  async function revokeRefreshToken(refreshRaw: string): Promise<void> {
    await redis.del(redisRefreshKey(refreshRaw));
  }

  async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, publicKey, { algorithms: ["RS256"] });
      const sub = payload.sub;
      const roleRaw = payload.role;
      if (typeof sub !== "string" || sub.length === 0) {
        throw new UnauthorizedError("Invalid access token");
      }
      if (roleRaw !== "BUYER" && roleRaw !== "ADMIN" && roleRaw !== "STORE_OWNER") {
        throw new UnauthorizedError("Invalid access token");
      }
      return {
        role: roleRaw,
        sub
      };
    } catch {
      throw new UnauthorizedError("Invalid access token");
    }
  }

  return {
    issueTokens,
    revokeRefreshToken,
    rotateRefreshToken,
    verifyAccessToken
  };
}
