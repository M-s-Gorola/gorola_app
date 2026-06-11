/*
  Warnings:

  - You are about to drop the column `storeId` on the `DeliveryRider` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "DeliveryRider" DROP CONSTRAINT "DeliveryRider_storeId_fkey";

-- DropIndex
DROP INDEX "DeliveryRider_storeId_isActive_isDeleted_idx";

-- AlterTable
ALTER TABLE "DeliveryRider" DROP COLUMN "storeId";

-- CreateTable
CREATE TABLE "RiderStore" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiderStore_riderId_idx" ON "RiderStore"("riderId");

-- CreateIndex
CREATE INDEX "RiderStore_storeId_idx" ON "RiderStore"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "RiderStore_riderId_storeId_key" ON "RiderStore"("riderId", "storeId");

-- CreateIndex
CREATE INDEX "DeliveryRider_isActive_isDeleted_idx" ON "DeliveryRider"("isActive", "isDeleted");

-- AddForeignKey
ALTER TABLE "RiderStore" ADD CONSTRAINT "RiderStore_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "DeliveryRider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderStore" ADD CONSTRAINT "RiderStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
