import type { PrismaClient } from "@prisma/client";

import { getLogger } from "../lib/logger.js";
import { AgeGateRepository } from "../modules/age-gate/age-gate.repository.js";

/**
 * Purges expired AgeGateLockout records whose lockout duration has passed (lockedUntil <= now)
 * under DPDP Act 2023 Sec 12 storage limitation principles.
 */
export async function purgeExpiredAgeGateLockouts(
  nowOrDb?: Date | PrismaClient | AgeGateRepository,
  maybeNow?: Date
): Promise<{ purgedCount: number }> {
  const logger = getLogger();

  let repo: AgeGateRepository;
  let now: Date;

  if (nowOrDb instanceof Date) {
    repo = new AgeGateRepository();
    now = nowOrDb;
  } else if (nowOrDb instanceof AgeGateRepository) {
    repo = nowOrDb;
    now = maybeNow ?? new Date();
  } else if (nowOrDb) {
    repo = new AgeGateRepository(nowOrDb);
    now = maybeNow ?? new Date();
  } else {
    repo = new AgeGateRepository();
    now = maybeNow ?? new Date();
  }

  try {
    const purgedCount = await repo.deleteExpired(now);

    logger.info(
      { purgedCount, cutoffDate: now.toISOString() },
      "[DPDP_AGE_GATE_PURGE] Expired age-gate lockout records purged successfully"
    );

    return {
      purgedCount
    };
  } catch (err) {
    logger.error(
      { err, cutoffDate: now.toISOString() },
      "[DPDP_AGE_GATE_PURGE_ERROR] Failed to purge expired age-gate lockouts"
    );
    throw err;
  }
}
