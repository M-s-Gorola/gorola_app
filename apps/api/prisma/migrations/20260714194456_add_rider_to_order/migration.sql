-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "riderId" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "DeliveryRider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
