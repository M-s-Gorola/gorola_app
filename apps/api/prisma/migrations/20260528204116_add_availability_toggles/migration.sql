-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "isAvailableForBooking" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "isAcceptingOrders" BOOLEAN NOT NULL DEFAULT true;
