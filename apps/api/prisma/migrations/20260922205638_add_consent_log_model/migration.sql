-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('OTP_AUTH', 'ORDER_PROCESSING', 'MARKETING_EMAIL', 'ANALYTICS');

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "consentVersion" TEXT NOT NULL DEFAULT '1.0',
    "noticeText" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentLog_userId_purpose_idx" ON "ConsentLog"("userId", "purpose");

-- CreateIndex
CREATE INDEX "ConsentLog_userId_isWithdrawn_idx" ON "ConsentLog"("userId", "isWithdrawn");

-- CreateIndex
CREATE INDEX "ConsentLog_createdAt_idx" ON "ConsentLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
