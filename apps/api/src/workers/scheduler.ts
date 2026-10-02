import type { PrismaClient } from "@prisma/client";

import { getLogger } from "../lib/logger.js";
import { UserRepository } from "../modules/user/user.repository.js";
import { archiveExpiredAuditLogs } from "./audit-log-archive.worker.js";
import { purgeExpiredOtpLogs } from "./otp-log-purge.worker.js";
import { purgeExpiredUsers } from "./user-data-purge.worker.js";

export type RetentionSchedulerOptions = {
  prisma: PrismaClient;
};

/**
 * Runs all automated data retention purge routines synchronously (e.g. for manual invoke or test).
 */
export async function runAllRetentionPurgeJobs(
  options: RetentionSchedulerOptions,
  now: Date = new Date()
): Promise<{
  usersPurged: number;
  auditLogsArchived: number;
  otpLogsPurged: number;
}> {
  const logger = getLogger();
  logger.info("[RETENTION_CRON] Starting automated DPDP data retention purge cycle...");

  const userRepo = new UserRepository(options.prisma);

  const userResult = await purgeExpiredUsers(userRepo, options.prisma, now);
  const auditResult = await archiveExpiredAuditLogs(options.prisma, now);
  const otpResult = await purgeExpiredOtpLogs(options.prisma, now);

  logger.info(
    {
      usersPurged: userResult.purgedCount,
      auditLogsArchived: auditResult.archivedCount,
      otpLogsPurged: otpResult.purgedCount
    },
    "[RETENTION_CRON] Completed automated DPDP data retention purge cycle"
  );

  return {
    usersPurged: userResult.purgedCount,
    auditLogsArchived: auditResult.archivedCount,
    otpLogsPurged: otpResult.purgedCount
  };
}
