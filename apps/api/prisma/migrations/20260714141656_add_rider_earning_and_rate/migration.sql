-- CreateEnum
CREATE TYPE "EarningType" AS ENUM ('PER_ORDER', 'PER_KM');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "riderEarningRatePct" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "RiderEarning" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "earningType" "EarningType" NOT NULL DEFAULT 'PER_ORDER',
    "distanceKm" DECIMAL(8,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderEarning_orderId_key" ON "RiderEarning"("orderId");

-- CreateIndex
CREATE INDEX "RiderEarning_riderId_createdAt_idx" ON "RiderEarning"("riderId", "createdAt");

-- AddForeignKey
ALTER TABLE "RiderEarning" ADD CONSTRAINT "RiderEarning_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "DeliveryRider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderEarning" ADD CONSTRAINT "RiderEarning_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
