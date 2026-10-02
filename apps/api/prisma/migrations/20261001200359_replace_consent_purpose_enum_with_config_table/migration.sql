-- CreateTable
CREATE TABLE "ConsentPurposeConfig" (
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isEssential" BOOLEAN NOT NULL DEFAULT false,
    "retentionSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentPurposeConfig_pkey" PRIMARY KEY ("key")
);

-- Seed ConsentPurposeConfig canonical rows
INSERT INTO "ConsentPurposeConfig" ("key", "displayName", "description", "isEssential", "retentionSummary", "createdAt", "updatedAt")
VALUES
  ('OTP_AUTH',           'Authentication & Account Security',     'Verifies your identity via One-Time Password.', true,  'Lifetime of account; deleted within 30 days of account erasure.', now(), now()),
  ('ORDER_PROCESSING',   'Order Fulfillment & Location Services', 'Processes your location and order details for delivery.', true, 'Addresses deleted on erasure. Order GPS nulled on erasure; financials kept 7 years (GST).', now(), now()),
  ('MARKETING_COMMS',    'Promotions & Seasonal Offers',          'Sends you optional hill-station discounts and store coupons.', false, 'Scrubbed from all distributions within 48 hours of withdrawal.', now(), now()),
  ('ANALYTICS',          'Usage & Performance Analytics',         'Collects anonymous performance telemetry to improve the app.', false, 'Aggregated logs purged or anonymised after 180 days.', now(), now());

-- Alter column purpose from enum to TEXT preserving data
ALTER TABLE "ConsentLog" ALTER COLUMN "purpose" TYPE TEXT USING "purpose"::TEXT;

-- Rename all existing MARKETING_EMAIL rows to MARKETING_COMMS
UPDATE "ConsentLog" SET "purpose" = 'MARKETING_COMMS' WHERE "purpose" = 'MARKETING_EMAIL';

-- DropEnum
DROP TYPE "ConsentPurpose";

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_purpose_fkey" FOREIGN KEY ("purpose") REFERENCES "ConsentPurposeConfig"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
