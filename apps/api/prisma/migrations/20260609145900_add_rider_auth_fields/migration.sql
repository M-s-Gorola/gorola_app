/*
  Warnings:

  - Added the required column `email` to the `DeliveryRider` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `DeliveryRider` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DeliveryRider" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRider_email_key" ON "DeliveryRider"("email");
