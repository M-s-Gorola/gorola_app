-- DropForeignKey
ALTER TABLE "Discount" DROP CONSTRAINT "Discount_storeId_fkey";

-- DropIndex
DROP INDEX "Discount_code_key";

-- AlterTable
ALTER TABLE "Discount" ALTER COLUMN "storeId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "appliedDiscountCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Discount_storeId_code_key" ON "Discount"("storeId", "code");

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
