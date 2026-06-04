import { NotFoundError, RateLimitError, UnauthorizedError } from "@gorola/shared";
import { compare } from "bcryptjs";

export type AdminAuthServiceDependencies = {
  redis: {
    del: (key: string) => Promise<unknown>;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<unknown>;
  };
  adminRepository: {
    findByEmail: (email: string) => Promise<{
      email: string;
      id: string;
      passwordHash: string;
      totpSecret: string | null;
    } | null>;
    updateTotpSecret: (id: string, secret: string) => Promise<unknown>;
  };
  tokenService: {
    issueTokens: (input: { role: "ADMIN"; sub: string }) => Promise<{
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

export class AdminAuthService {
  public constructor(private readonly deps: AdminAuthServiceDependencies) {}

  public async refreshToken(input: { refreshToken: string }): Promise<{ accessToken: string; refreshToken: string }> {
    const key = `rt:admin:${input.refreshToken}`;
    const raw = await this.deps.redis.get(key);
    if (!raw) {
      throw new UnauthorizedError("Session has expired or is invalid.");
    }
    const session = JSON.parse(raw) as { role: "ADMIN"; userId: string };

    await this.deps.redis.del(key);

    return this.deps.tokenService.issueTokens({
      role: "ADMIN",
      sub: session.userId
    });
  }

  public async logout(input: { refreshToken: string }): Promise<void> {
    const key = `rt:admin:${input.refreshToken}`;
    await this.deps.redis.del(key);
  }

  private getLoginRateLimitKey(email: string): string {
    return `auth:admin:login:${email.toLowerCase()}`;
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

    const admin = await this.deps.adminRepository.findByEmail(input.email);
    const failedAuthError = new UnauthorizedError("Invalid email or password");
    if (!admin) {
      const baseCount = rateLimit ? rateLimit.count : 0;
      const windowStartedAt =
        rateLimit && now - new Date(rateLimit.windowStartedAt).getTime() < 15 * 60 * 1000
          ? rateLimit.windowStartedAt
          : new Date(now).toISOString();
      await this.writeLoginRateLimit(input.email, baseCount + 1, windowStartedAt);
      throw failedAuthError;
    }

    const validPassword = await compare(input.password, admin.passwordHash);
    if (!validPassword) {
      const baseCount = rateLimit ? rateLimit.count : 0;
      const windowStartedAt =
        rateLimit && now - new Date(rateLimit.windowStartedAt).getTime() < 15 * 60 * 1000
          ? rateLimit.windowStartedAt
          : new Date(now).toISOString();
      await this.writeLoginRateLimit(input.email, baseCount + 1, windowStartedAt);
      throw failedAuthError;
    }

    if (!admin.totpSecret) {
      throw new UnauthorizedError("Admin 2FA is not configured");
    }

    if (!input.totpCode) {
      return { requiresTwoFactor: true };
    }

    const validTotp = this.deps.totpProvider.verify({
      code: input.totpCode,
      secret: admin.totpSecret
    });
    if (!validTotp) {
      throw new UnauthorizedError("Invalid TOTP code");
    }

    return this.deps.tokenService.issueTokens({
      role: "ADMIN",
      sub: admin.id
    });
  }

  public async setup2FA(input: {
    email: string;
  }): Promise<{ secret: string; qrCodeUri: string }> {
    const admin = await this.deps.adminRepository.findByEmail(input.email);
    if (!admin) {
      throw new NotFoundError("Admin not found");
    }

    const secret = this.deps.totpProvider.generateSecret();
    const qrCodeUri = this.deps.totpProvider.keyUri({
      accountName: admin.email,
      issuer: "GoRola",
      secret
    });

    await this.deps.adminRepository.updateTotpSecret(admin.id, secret);
    return {
      secret,
      qrCodeUri
    };
  }

  public async verify2FA(input: { email: string; code: string }): Promise<void> {
    const admin = await this.deps.adminRepository.findByEmail(input.email);
    if (!admin || !admin.totpSecret) {
      throw new NotFoundError("Admin 2FA setup not found");
    }

    const valid = this.deps.totpProvider.verify({
      code: input.code,
      secret: admin.totpSecret
    });
    if (!valid) {
      throw new UnauthorizedError("Invalid TOTP code");
    }
  }
}
