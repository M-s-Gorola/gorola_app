import { AppError, RateLimitError, UnauthorizedError } from "@gorola/shared";
import { compare } from "bcryptjs";

export type RiderAuthServiceDependencies = {
  redis: {
    del: (key: string) => Promise<unknown>;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<unknown>;
  };
  riderRepository: {
    findByEmail: (email: string) => Promise<{
      id: string;
      email: string;
      passwordHash: string;
      storeId: string;
      isActive: boolean;
    } | null>;
  };
  tokenService: {
    issueTokens: (input: { role: "RIDER"; storeId: string; sub: string }) => Promise<{
      accessToken: string;
      refreshToken: string;
    }>;
  };
};

export class RiderAuthService {
  public constructor(private readonly deps: RiderAuthServiceDependencies) {}

  public async refreshToken(input: { refreshToken: string }): Promise<{ accessToken: string; refreshToken: string }> {
    const key = `rt:rider:${input.refreshToken}`;
    const raw = await this.deps.redis.get(key);
    if (!raw) {
      throw new UnauthorizedError("Session has expired or is invalid.");
    }
    const session = JSON.parse(raw) as { role: "RIDER"; storeId: string; userId: string };

    await this.deps.redis.del(key);

    return this.deps.tokenService.issueTokens({
      role: "RIDER",
      storeId: session.storeId,
      sub: session.userId
    });
  }

  public async logout(input: { refreshToken: string }): Promise<void> {
    const key = `rt:rider:${input.refreshToken}`;
    await this.deps.redis.del(key);
  }

  private getLoginRateLimitKey(email: string): string {
    return `auth:rider:login:${email.toLowerCase()}`;
  }

  private async readLoginRateLimit(email: string): Promise<{
    count: number;
    windowStartedAt: string;
  } | null> {
    const raw = await this.deps.redis.get(this.getLoginRateLimitKey(email));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as { count: number; windowStartedAt: string };
  }

  private async writeLoginRateLimit(email: string, count: number, windowStartedAt: string): Promise<void> {
    await this.deps.redis.set(
      this.getLoginRateLimitKey(email),
      JSON.stringify({ count, windowStartedAt }),
      "EX",
      15 * 60
    );
  }

  public async login(input: {
    email: string;
    password: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const now = Date.now();
    const rateLimit = await this.readLoginRateLimit(input.email);
    if (rateLimit) {
      const windowStartedAtMs = new Date(rateLimit.windowStartedAt).getTime();
      if (now - windowStartedAtMs < 15 * 60 * 1000 && rateLimit.count >= 10) {
        throw new RateLimitError("Too many login attempts");
      }
    }

    const rider = await this.deps.riderRepository.findByEmail(input.email);
    // Use AppError with AUTH_FAILED code to match the required status response
    const failedAuthError = new AppError("Invalid email or password", {
      code: "AUTH_FAILED",
      statusCode: 401
    });

    if (!rider) {
      const baseCount = rateLimit ? rateLimit.count : 0;
      const windowStartedAt =
        rateLimit && now - new Date(rateLimit.windowStartedAt).getTime() < 15 * 60 * 1000
          ? rateLimit.windowStartedAt
          : new Date(now).toISOString();
      await this.writeLoginRateLimit(input.email, baseCount + 1, windowStartedAt);
      throw failedAuthError;
    }

    if (!rider.isActive) {
      throw new AppError("Account suspended", {
        code: "ACCOUNT_SUSPENDED",
        statusCode: 403
      });
    }

    const validPassword = await compare(input.password, rider.passwordHash);
    if (!validPassword) {
      const baseCount = rateLimit ? rateLimit.count : 0;
      const windowStartedAt =
        rateLimit && now - new Date(rateLimit.windowStartedAt).getTime() < 15 * 60 * 1000
          ? rateLimit.windowStartedAt
          : new Date(now).toISOString();
      await this.writeLoginRateLimit(input.email, baseCount + 1, windowStartedAt);
      throw failedAuthError;
    }

    return this.deps.tokenService.issueTokens({
      role: "RIDER",
      storeId: rider.storeId,
      sub: rider.id
    });
  }
}
