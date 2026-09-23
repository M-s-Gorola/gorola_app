import type { PrismaClient } from "@prisma/client";

import { getLogger } from "../lib/logger.js";
import type { UserRepository } from "../modules/user/user.repository.js";

export async function purgeExpiredUsers(
  userRepository: UserRepository,
  prisma: PrismaClient,
  now: Date = new Date()
): Promise<{ purgedCount: number; userIds: string[] }> {
  const logger = getLogger();

  // Find all users whose 30-day grace period has expired and who were not reactivated
  const expiredUsers = await prisma.user.findMany({
    where: {
      deletedAt: { not: null },
      deletionScheduledFor: { lte: now },
      isDeleted: false
    },
    select: { id: true }
  });

  const userIds: string[] = [];

  for (const user of expiredUsers) {
    try {
      await userRepository.permanentPurgeAndAnonymize(user.id);
      userIds.push(user.id);
      logger.info(
        { userId: user.id },
        "[DPDP_PURGE] User account and personal data permanently purged under DPDP Act Sec 12"
      );
    } catch (err) {
      logger.error(
        { err, userId: user.id },
        "[DPDP_PURGE_ERROR] Failed to execute permanent purge for user"
      );
    }
  }

  return {
    purgedCount: userIds.length,
    userIds
  };
}
