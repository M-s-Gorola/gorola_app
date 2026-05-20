-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('QUICK_COMMERCE', 'BOOKING_COMMERCE');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('QUICK', 'BOOKING');

-- CreateEnum
CREATE TYPE "BookingApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiderType" AS ENUM ('DELIVERY', 'FIELD_TECHNICIAN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "OrderStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "DeliveryRider" ADD COLUMN     "riderType" "RiderType" NOT NULL DEFAULT 'DELIVERY';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderType" "OrderType" NOT NULL DEFAULT 'QUICK';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "allowedTimeslots" TEXT[],
ADD COLUMN     "requiresFasting" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "bookingLeadDays" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isAcceptingBookings" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "storeType" "StoreType" NOT NULL DEFAULT 'QUICK_COMMERCE';

-- CreateTable
CREATE TABLE "BookingOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "timeslot" TEXT NOT NULL,
    "requiresFasting" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "BookingApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedAt" TIMESTAMP(3),
    "approvedByOwnerId" TEXT,
    "rejectionReason" TEXT,
    "assignedTechnicianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingOrder_orderId_key" ON "BookingOrder"("orderId");

-- AddForeignKey
ALTER TABLE "BookingOrder" ADD CONSTRAINT "BookingOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
