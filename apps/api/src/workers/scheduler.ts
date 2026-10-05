import type { PrismaClient } from "@prisma/client";

import { getLogger } from "../lib/logger.js";
import { UserRepository } from "../modules/user/user.repository.js";
import { purgeExpiredAgeGateLockouts } from "./age-gate-lockout-purge.worker.js";
import { archiveExpiredAuditLogs } from "./audit-log-archive.worker.js";
import { purgeExpiredOtpLogs } from "./otp-log-purge.worker.js";
import { purgeExpiredUsers } from "./user-data-purge.worker.js";

export type RetentionSchedulerOptions = {
  prisma: PrismaClient;
};

export type ScheduledJob = {
  name: string;
  cron: string;
  description: string;
  handler: (options: RetentionSchedulerOptions, now?: Date) => Promise<unknown>;
};

export const SCHEDULED_RETENTION_JOBS: ScheduledJob[] = [
  {
    name: "user-data-purge",
    cron: "0 2 * * *",
    description: "Permanently purges soft-deleted users past 30-day grace period under DPDP Sec 12",
    handler: async (options, now) => {
      const userRepo = new UserRepository(options.prisma);
      return purgeExpiredUsers(userRepo, options.prisma, now);
    }
  },
  {
    name: "audit-log-archive",
    cron: "0 3 * * *",
    description: "Purges audit logs older than 365 days under DPDP Sec 12",
    handler: async (options, now) => archiveExpiredAuditLogs(options.prisma, now)
  },
  {
    name: "otp-log-purge",
    cron: "0 4 * * *",
    description: "Purges ephemeral OTP logs older than 90 days under DPDP Sec 12",
    handler: async (options, now) => purgeExpiredOtpLogs(options.prisma, now)
  },
  {
    name: "age-gate-lockout-purge",
    cron: "0 5 * * *",
    description: "Deletes expired age-gate lockout entries past their lockout window under DPDP Sec 12",
    handler: async (options, now) => purgeExpiredAgeGateLockouts(options.prisma, now)
  }
];

export function getScheduledJobs(): ScheduledJob[] {
  return SCHEDULED_RETENTION_JOBS;
}

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
  ageGateLockoutsPurged: number;
}> {
  const logger = getLogger();
  logger.info("[RETENTION_CRON] Starting automated DPDP data retention purge cycle...");

  const userRepo = new UserRepository(options.prisma);

  const userResult = await purgeExpiredUsers(userRepo, options.prisma, now);
  const auditResult = await archiveExpiredAuditLogs(options.prisma, now);
  const otpResult = await purgeExpiredOtpLogs(options.prisma, now);
  const ageGateResult = await purgeExpiredAgeGateLockouts(options.prisma, now);

  logger.info(
    {
      usersPurged: userResult.purgedCount,
      auditLogsArchived: auditResult.archivedCount,
      otpLogsPurged: otpResult.purgedCount,
      ageGateLockoutsPurged: ageGateResult.purgedCount
    },
    "[RETENTION_CRON] Completed automated DPDP data retention purge cycle"
  );

  return {
    usersPurged: userResult.purgedCount,
    auditLogsArchived: auditResult.archivedCount,
    otpLogsPurged: otpResult.purgedCount,
    ageGateLockoutsPurged: ageGateResult.purgedCount
  };
}
