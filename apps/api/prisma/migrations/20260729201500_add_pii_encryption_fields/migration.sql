-- AlterTable
ALTER TABLE "DeliveryRider" ADD COLUMN IF NOT EXISTS "phoneHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryRider_phoneHash_key" ON "DeliveryRider"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneHash_key" ON "User"("phoneHash");
