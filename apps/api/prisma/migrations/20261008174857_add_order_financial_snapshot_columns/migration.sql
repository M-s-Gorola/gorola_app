-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "appliedOfferTitle" TEXT,
ADD COLUMN     "discountSavingAmount" DECIMAL(10,2),
ADD COLUMN     "offerSavingAmount" DECIMAL(10,2),
ADD COLUMN     "taxRate" DECIMAL(5,2);
