-- DropForeignKey
ALTER TABLE "RiderEarning" DROP CONSTRAINT "RiderEarning_orderId_fkey";

-- DropForeignKey
ALTER TABLE "RiderEarning" DROP CONSTRAINT "RiderEarning_riderId_fkey";

-- AddForeignKey
ALTER TABLE "RiderEarning" ADD CONSTRAINT "RiderEarning_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "DeliveryRider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderEarning" ADD CONSTRAINT "RiderEarning_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
