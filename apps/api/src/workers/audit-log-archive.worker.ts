import type { PrismaClient } from "@prisma/client";

import { getLogger } from "../lib/logger.js";

/**
 * Purges or archives AuditLog records older than retentionDays (default: 365 days / 1 year)
 * under DPDP Act 2023 Sec 12 storage limitation principles.
 */
export async function archiveExpiredAuditLogs(
  prisma: PrismaClient,
  now: Date = new Date(),
  retentionDays = 365
): Promise<{ archivedCount: number }> {
  const logger = getLogger();
  const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info(
      { archivedCount: result.count, cutoffDate: cutoffDate.toISOString() },
      "[DPDP_AUDIT_PURGE] Audit logs older than retention period purged successfully"
    );

    return {
      archivedCount: result.count
    };
  } catch (err) {
    logger.error(
      { err, cutoffDate: cutoffDate.toISOString() },
      "[DPDP_AUDIT_PURGE_ERROR] Failed to purge expired audit logs"
    );
    throw err;
  }
}
