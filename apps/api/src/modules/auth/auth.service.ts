import { randomUUID } from "node:crypto";

import { AppError, RateLimitError, UnauthorizedError, ValidationError } from "@gorola/shared";
import { compare, hash } from "bcryptjs";

import { getLogger, logSecurityAlert } from "../../lib/logger.js";
import type {
  ActiveSession,
  BuyerRefreshSuccess,
  BuyerVerifySuccess,
  LogoutInput,
  OtpProvider,
  OtpStoreRecord,
  RedisLikeClient,
  RefreshTokenInput,
  SendOtpInput,
  SessionContext,
  StoredSessionRecord,
  TokenService,
  VerifyOtpInput
} from "./auth.types.js";
import { generateBuyerOtp } from "./generate-buyer-otp.js";


const USER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type BuyerUserLookup = {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  privacyPolicyVersionAccepted?: string | undefined;
  deletedAt?: Date | null;
  deletionScheduledFor?: Date | null;
};

export type AuthServiceDependencies = {
  ensureBuyerUser: (phone: string) => Promise<BuyerUserLookup>;
  findUserById: (id: string) => Promise<BuyerUserLookup | null>;
  otpProvider: OtpProvider;
  otpTtlSeconds: number;
  redis: RedisLikeClient;
  tokenService: TokenService;
};

export class AuthService {
  public constructor(private readonly deps: AuthServiceDependencies) {}

  private userSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  private async loadUserSessions(userId: string): Promise<StoredSessionRecord[]> {
    const raw = await this.deps.redis.get(this.userSessionsKey(userId));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredSessionRecord[]) : [];
    } catch {
      return [];
    }
  }

  private async saveUserSessions(userId: string, sessions: StoredSessionRecord[]): Promise<void> {
    await this.deps.redis.set(
      this.userSessionsKey(userId),
      JSON.stringify(sessions),
      "EX",
      USER_SESSION_TTL_SECONDS
    );
  }

  public async sendOtp(input: SendOtpInput): Promise<void> {
    const phone = input.phone.trim();
    if (!/^\+91\d{10}$/.test(phone)) {
      throw new ValidationError("Invalid phone format");
    }

    const key = `otp:${phone}`;
    const now = Date.now();
    const existing = await this.deps.redis.get(key);
    const existingRecord = existing !== null ? (JSON.parse(existing) as OtpStoreRecord) : null;

    if (existingRecord !== null) {
      const windowStarted = new Date(existingRecord.sentWindowStartedAt).getTime();
      const withinWindow = now - windowStarted < 15 * 60 * 1000;
      if (withinWindow && existingRecord.sentCount >= 5) {
        throw new RateLimitError("Too many attempts — try in 15 minutes");
      }
    }

    const otpPlain = generateBuyerOtp();
    const hashedOtp = await hash(otpPlain, 8);
    const sentWindowStartedAt =
      existingRecord !== null &&
      now - new Date(existingRecord.sentWindowStartedAt).getTime() < 15 * 60 * 1000
        ? existingRecord.sentWindowStartedAt
        : new Date(now).toISOString();
    const sentCount =
      existingRecord !== null && sentWindowStartedAt === existingRecord.sentWindowStartedAt
        ? existingRecord.sentCount + 1
        : 1;

    const record: OtpStoreRecord = {
      attempts: 0,
      expiresAt: new Date(now + this.deps.otpTtlSeconds * 1000).toISOString(),
      hashedOtp,
      sentCount,
      sentWindowStartedAt
    };

    await this.deps.redis.set(key, JSON.stringify(record), "EX", this.deps.otpTtlSeconds);
    await this.deps.otpProvider.sendOtp(phone, otpPlain);
  }

  /** Verifies OTP, persists/fetches buyer {@link BuyerUserLookup}, issues RS256-backed tokens, records active session. */
  public async verifyOtp(
    input: VerifyOtpInput,
    context?: SessionContext
  ): Promise<BuyerVerifySuccess> {
    const key = `otp:${input.phone}`;
    const payload = await this.deps.redis.get(key);
    if (payload === null) {
      throw new UnauthorizedError("OTP not found");
    }

    const record = JSON.parse(payload) as OtpStoreRecord;
    if (record.attempts >= 3) {
      throw new RateLimitError(
        "Too many incorrect OTP attempts. Try requesting a new code."
      );
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedError("OTP expired");
    }

    const valid = await compare(input.otp, record.hashedOtp);
    if (!valid) {
      const nextAttempts = record.attempts + 1;
      const attemptsRemainingAfterThisFailure = Math.max(0, 3 - nextAttempts);
      const nextRecord: OtpStoreRecord = {
        ...record,
        attempts: nextAttempts
      };
      await this.deps.redis.set(key, JSON.stringify(nextRecord), "EX", this.deps.otpTtlSeconds);

      if (nextAttempts >= 3) {
        logSecurityAlert(getLogger(), {
          alertType: "FAILED_AUTH_BURST",
          ipAddress: context?.ipAddress,
          path: "/api/v1/auth/buyer/verify-otp",
          message: "Account locked out after 3 consecutive failed OTP attempts",
          details: { phoneHashPrefix: input.phone.slice(-4), attempts: nextAttempts }
        });
        throw new RateLimitError(
          "Too many incorrect OTP attempts. Try requesting a new code."
        );
      }
      throw new UnauthorizedError("Invalid OTP", {
        attemptsRemaining: attemptsRemainingAfterThisFailure
      });
    }


    const user = await this.deps.ensureBuyerUser(input.phone);
    if (!user.isActive) {
      throw new AppError("Account suspended", { code: "ACCOUNT_SUSPENDED", statusCode: 403 });
    }
    const tokens = await this.deps.tokenService.issueTokens({
      name: user.name.trim().length === 0 ? null : user.name,
      phone: user.phone,
      userId: user.id
    });
    await this.deps.redis.del(key);

    // Record session
    const nowIso = new Date().toISOString();
    const newSession: StoredSessionRecord = {
      sessionId: randomUUID(),
      refreshToken: tokens.refreshToken,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      createdAt: nowIso,
      lastActiveAt: nowIso
    };

    const existingSessions = await this.loadUserSessions(user.id);
    existingSessions.push(newSession);
    await this.saveUserSessions(user.id, existingSessions);

    return {
      ...tokens,
      name: user.name.trim().length === 0 ? null : user.name,
      phone: user.phone,
      userId: user.id,
      privacyPolicyVersionAccepted: user.privacyPolicyVersionAccepted,
      isPendingDeletion: Boolean(user.deletedAt),
      deletionScheduledFor: user.deletionScheduledFor ? user.deletionScheduledFor.toISOString() : null
    };
  }

  public async refreshToken(
    input: RefreshTokenInput,
    context?: SessionContext
  ): Promise<BuyerRefreshSuccess> {
    const payload = await this.deps.tokenService.verifyRefreshToken(input.refreshToken);
    await this.deps.tokenService.revokeRefreshToken(input.refreshToken);

    const user = await this.deps.findUserById(payload.userId);
    if (user === null || !user.isActive) {
      throw new UnauthorizedError("User session no longer valid.");
    }

    const newTokens = await this.deps.tokenService.issueTokens({
      name: user.name.trim().length === 0 ? null : user.name,
      phone: user.phone,
      userId: user.id
    });

    // Update active session record with rotated refresh token and lastActiveAt
    const sessions = await this.loadUserSessions(user.id);
    const matchedSession = sessions.find((s) => s.refreshToken === input.refreshToken);
    if (matchedSession) {
      matchedSession.refreshToken = newTokens.refreshToken;
      matchedSession.lastActiveAt = new Date().toISOString();
      if (context?.ipAddress) matchedSession.ipAddress = context.ipAddress;
      if (context?.userAgent) matchedSession.userAgent = context.userAgent;
    } else {
      sessions.push({
        sessionId: randomUUID(),
        refreshToken: newTokens.refreshToken,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      });
    }
    await this.saveUserSessions(user.id, sessions);

    return {
      ...newTokens,
      privacyPolicyVersionAccepted: user.privacyPolicyVersionAccepted
    };
  }

  public async logout(input: LogoutInput): Promise<void> {
    try {
      const payload = await this.deps.tokenService.verifyRefreshToken(input.refreshToken);
      const sessions = await this.loadUserSessions(payload.userId);
      const filtered = sessions.filter((s) => s.refreshToken !== input.refreshToken);
      await this.saveUserSessions(payload.userId, filtered);
    } catch {
      // Ignore token verification errors during logout cleanup
    }
    await this.deps.tokenService.revokeRefreshToken(input.refreshToken);
  }

  /**
   * Returns all active sessions for a user, verifying whether their underlying refresh token is still valid.
   */
  public async getActiveSessions(
    userId: string,
    currentRefreshToken?: string
  ): Promise<ActiveSession[]> {
    const sessions = await this.loadUserSessions(userId);
    const validSessions: ActiveSession[] = [];
    const updatedStoredSessions: StoredSessionRecord[] = [];

    for (const s of sessions) {
      const rtExists = await this.deps.redis.get(`rt:${s.refreshToken}`);
      if (rtExists !== null) {
        updatedStoredSessions.push(s);
        validSessions.push({
          sessionId: s.sessionId,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          createdAt: s.createdAt,
          lastActiveAt: s.lastActiveAt,
          isCurrent: Boolean(currentRefreshToken && s.refreshToken === currentRefreshToken)
        });
      }
    }

    if (updatedStoredSessions.length !== sessions.length) {
      await this.saveUserSessions(userId, updatedStoredSessions);
    }

    return validSessions;
  }

  /**
   * Remotely terminates all active sessions for a user by revoking all refresh tokens and purging the user session index.
   */
  public async terminateAllSessions(userId: string): Promise<{ terminatedCount: number }> {
    const sessions = await this.loadUserSessions(userId);
    for (const s of sessions) {
      await this.deps.redis.del(`rt:${s.refreshToken}`);
    }
    await this.deps.redis.del(this.userSessionsKey(userId));
    return { terminatedCount: sessions.length };
  }
}

