import { NotFoundError, RateLimitError, UnauthorizedError } from "@gorola/shared";
import { compare } from "bcryptjs";

export type StoreOwnerAuthServiceDependencies = {
  redis: {
    del: (key: string) => Promise<unknown>;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<unknown>;
  };
  storeOwnerRepository: {
    findByEmail: (email: string) => Promise<{
      email: string;
      id: string;
      passwordHash: string;
      storeId: string;
      totpEnabled: boolean;
      totpSecret: string | null;
    } | null>;
    update: (
      id: string,
      payload: {
        totpEnabled?: boolean;
        totpSecret?: string | null;
      }
    ) => Promise<unknown>;
  };
  tokenService: {
    issueTokens: (input: { role: "STORE_OWNER"; storeId: string; sub: string }) => Promise<{
      accessToken: string;
      refreshToken: string;
    }>;
  };
  totpProvider: {
    generateSecret: () => string;
    keyUri: (input: { accountName: string; issuer: string; secret: string }) => string;
    verify: (input: { code: string; secret: string }) => boolean;
  };
};

export class StoreOwnerAuthService {
  public constructor(private readonly deps: StoreOwnerAuthServiceDependencies) {}

  public async refreshToken(input: { refreshToken: string }): Promise<{ accessToken: string; refreshToken: string }> {
    const key = `rt:store-owner:${input.refreshToken}`;
    const raw = await this.deps.redis.get(key);
    if (!raw) {
      throw new UnauthorizedError("Session has expired or is invalid.");
    }
    const session = JSON.parse(raw) as { role: "STORE_OWNER"; storeId: string; userId: string };

    await this.deps.redis.del(key);

    return this.deps.tokenService.issueTokens({
      role: "STORE_OWNER",
      storeId: session.storeId,
      sub: session.userId
    });
  }

  public async logout(input: { refreshToken: string }): Promise<void> {
    const key = `rt:store-owner:${input.refreshToken}`;
    await this.deps.redis.del(key);
  }

  private getLoginRateLimitKey(email: string): string {
    return `auth:store-owner:login:${email.toLowerCase()}`;
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
    totpCode?: string | undefined;
  }): Promise<{ accessToken: string; refreshToken: string } | { requiresTwoFactor: true }> {
    const now = Date.now();
    const rateLimit = await this.readLoginRateLimit(input.email);
    if (rateLimit) {
      const windowStartedAtMs = new Date(rateLimit.windowStartedAt).getTime();
      if (now - windowStartedAtMs < 15 * 60 * 1000 && rateLimit.count >= 10) {
        throw new RateLimitError("Too many login attempts");
      }
    }

    const owner = await this.deps.storeOwnerRepository.findByEmail(input.email);
    const failedAuthError = new UnauthorizedError("Invalid email or password");
    if (!owner) {
      const baseCount = rateLimit ? rateLimit.count : 0;
      const windowStartedAt =
        rateLimit && now - new Date(rateLimit.windowStartedAt).getTime() < 15 * 60 * 1000
          ? rateLimit.windowStartedAt
          : new Date(now).toISOString();
      await this.writeLoginRateLimit(input.email, baseCount + 1, windowStartedAt);
      throw failedAuthError;
    }

    const validPassword = await compare(input.password, owner.passwordHash);
    if (!validPassword) {
      const baseCount = rateLimit ? rateLimit.count : 0;
      const windowStartedAt =
        rateLimit && now - new Date(rateLimit.windowStartedAt).getTime() < 15 * 60 * 1000
          ? rateLimit.windowStartedAt
          : new Date(now).toISOString();
      await this.writeLoginRateLimit(input.email, baseCount + 1, windowStartedAt);
      throw failedAuthError;
    }

    if (owner.totpEnabled) {
      if (!input.totpCode) {
        return { requiresTwoFactor: true };
      }
      if (!owner.totpSecret) {
        throw new UnauthorizedError("2FA is not configured");
      }
      const totpOk = this.deps.totpProvider.verify({
        code: input.totpCode,
        secret: owner.totpSecret
      });
      if (!totpOk) {
        throw new UnauthorizedError("Invalid TOTP code");
      }
    }

    return this.deps.tokenService.issueTokens({
      role: "STORE_OWNER",
      storeId: owner.storeId,
      sub: owner.id
    });
  }

  public async setup2FA(input: {
    email: string;
  }): Promise<{ secret: string; qrCodeUri: string }> {
    const owner = await this.deps.storeOwnerRepository.findByEmail(input.email);
    if (!owner) {
      throw new NotFoundError("Store owner not found");
    }

    const secret = this.deps.totpProvider.generateSecret();
    const qrCodeUri = this.deps.totpProvider.keyUri({
      accountName: owner.email,
      issuer: "GoRola",
      secret
    });

    await this.deps.storeOwnerRepository.update(owner.id, {
      totpEnabled: false,
      totpSecret: secret
    });

    return {
      secret,
      qrCodeUri
    };
  }

  public async verify2FA(input: { email: string; code: string }): Promise<void> {
    const owner = await this.deps.storeOwnerRepository.findByEmail(input.email);
    if (!owner || !owner.totpSecret) {
      throw new NotFoundError("Store owner 2FA setup not found");
    }

    const valid = this.deps.totpProvider.verify({
      code: input.code,
      secret: owner.totpSecret
    });
    if (!valid) {
      throw new UnauthorizedError("Invalid TOTP code");
    }

    await this.deps.storeOwnerRepository.update(owner.id, {
      totpEnabled: true
    });
  }
}
