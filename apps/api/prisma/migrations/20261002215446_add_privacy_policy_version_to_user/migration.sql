-- DropIndex
DROP INDEX "User_deletedAt_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privacyPolicyVersionAccepted" TEXT NOT NULL DEFAULT '1.0';
