-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "ageConfirmedPolicyVersion" TEXT;

-- CreateTable
CREATE TABLE "AgeGateLockout" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "strikeCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgeGateLockout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgeGateLockout_phoneHash_key" ON "AgeGateLockout"("phoneHash");

-- CreateIndex
CREATE INDEX "AgeGateLockout_lockedUntil_idx" ON "AgeGateLockout"("lockedUntil");

-- Seed ConsentPurposeConfig canonical row for AGE_DECLARATION
INSERT INTO "ConsentPurposeConfig" ("key", "displayName", "description", "isEssential", "retentionSummary", "createdAt", "updatedAt")
VALUES ('AGE_DECLARATION', 'Age Confirmation', 'Confirmation that you are 18 or over. Your date of birth is used once and never stored.', true, 'The date you confirmed is kept for the life of your account. Your date of birth is never stored.', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

