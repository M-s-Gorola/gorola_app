/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `DeliveryRider` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRider_phone_key" ON "DeliveryRider"("phone");
