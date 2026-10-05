import type { AgeGateLockout } from "@prisma/client";

import { getPrismaClient } from "../../lib/prisma.js";

export class AgeGateRepository {
  private get db() {
    return getPrismaClient();
  }

  async upsertLock(phoneHash: string, lockedUntil: Date): Promise<AgeGateLockout> {
    return this.db.ageGateLockout.upsert({
      where: { phoneHash },
      create: {
        phoneHash,
        lockedUntil,
        strikeCount: 1
      },
      update: {
        lockedUntil,
        strikeCount: { increment: 1 }
      }
    });
  }

  async findActiveByPhoneHash(
    phoneHash: string,
    now: Date = new Date()
  ): Promise<AgeGateLockout | null> {
    return this.db.ageGateLockout.findFirst({
      where: {
        phoneHash,
        lockedUntil: { gt: now }
      }
    });
  }

  async deleteByPhoneHash(phoneHash: string): Promise<number> {
    const result = await this.db.ageGateLockout.deleteMany({
      where: { phoneHash }
    });
    return result.count;
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db.ageGateLockout.deleteMany({
      where: {
        lockedUntil: { lte: now }
      }
    });
    return result.count;
  }
}

export const ageGateRepository = new AgeGateRepository();
