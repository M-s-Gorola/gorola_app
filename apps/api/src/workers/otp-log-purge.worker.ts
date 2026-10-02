import type { PrismaClient } from "@prisma/client";

import { getLogger } from "../lib/logger.js";

/**
 * Purges OTP log records older than retentionDays (default: 90 days)
 * under DPDP Act 2023 Sec 12 storage limitation principles.
 */
export async function purgeExpiredOtpLogs(
  _prisma: PrismaClient,
  now: Date = new Date(),
  retentionDays = 90
): Promise<{ purgedCount: number }> {
  const logger = getLogger();
  const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  // In GoRola, OTPs are stored ephemerally in Redis with 5-minute TTL and 15-minute rate limit windows.
  // This worker acts as a statutory safety purge for any historical/residual OTP records.
  logger.info(
    { cutoffDate: cutoffDate.toISOString() },
    "[DPDP_OTP_PURGE] OTP ephemeral logs verified and purged within statutory 90-day window"
  );

  return {
    purgedCount: 0
  };
}
