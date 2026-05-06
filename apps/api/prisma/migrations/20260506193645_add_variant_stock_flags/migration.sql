-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "isInStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isLowStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;
