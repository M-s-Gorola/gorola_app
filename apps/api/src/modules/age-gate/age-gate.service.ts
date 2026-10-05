import type { AgeGateLockout } from "@prisma/client";

import { hashPII } from "../../lib/crypto.js";
import {
  type AgeGateRepository,
  ageGateRepository
} from "./age-gate.repository.js";

export class AgeGateService {
  constructor(private readonly repository: AgeGateRepository = ageGateRepository) {}

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
}

export const ageGateService = new AgeGateService();
