import type { AgeGateLockout } from "@prisma/client";

import { hashPII } from "../../lib/crypto.js";
import { getLogger, logSecurityAlert } from "../../lib/logger.js";
import { getRedisClient } from "../../lib/redis.js";
import type { RedisLikeClient } from "../auth/auth.types.js";
import {
  type AgeGateRepository,
  ageGateRepository
} from "./age-gate.repository.js";

export class AgeGateService {
  constructor(
    private readonly repository: AgeGateRepository = ageGateRepository,
    private readonly redis?: RedisLikeClient
  ) {}

  private get redisClient(): RedisLikeClient | null {
    if (this.redis) return this.redis;
    return getRedisClient() as unknown as RedisLikeClient | null;
  }

  private get lockoutDays(): number {
    const parsed = parseInt(process.env.AGE_GATE_LOCKOUT_DAYS || "90", 10);
    return isNaN(parsed) || parsed <= 0 ? 90 : parsed;
  }

  async isPhoneLocked(
    phone: string,
    now: Date = new Date()
  ): Promise<boolean> {
    const phoneHash = hashPII(phone);
    const lock = await this.repository.findActiveByPhoneHash(phoneHash, now);
    return lock !== null;
  }

  async lockPhone(
    phone: string,
    now: Date = new Date()
  ): Promise<AgeGateLockout> {
    const phoneHash = hashPII(phone);
    const lockedUntil = new Date(
      now.getTime() + this.lockoutDays * 24 * 60 * 60 * 1000
    );
    return this.repository.upsertLock(phoneHash, lockedUntil);
  }

  async unlockPhone(phone: string): Promise<boolean> {
    const phoneHash = hashPII(phone);
    const deletedCount = await this.repository.deleteByPhoneHash(phoneHash);
    return deletedCount > 0;
  }

  async recordRefusal(ipAddress?: string | null): Promise<number> {
    if (!ipAddress) {
      return 0;
    }
    const client = this.redisClient;
    if (!client) {
      return 0;
    }
    const key = `age_gate:refusals:${ipAddress}`;
    const raw = await client.get(key);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await client.set(key, count.toString(), "EX", 86400);

    if (count === 5) {
      logSecurityAlert(getLogger(), {
        alertType: "AGE_GATE_ABUSE",
        ipAddress,
        message: `High volume of age verification refusals from IP: ${ipAddress}`,
        details: { refusalCount: count }
      });
    }

    return count;
  }
}

export const ageGateService = new AgeGateService();

