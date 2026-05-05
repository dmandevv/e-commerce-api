/*
  Warnings:

  - Added the required column `variantId` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingCity` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingCountry` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingName` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingPostal` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingProvince` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingStreet` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "variantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shippingCity" TEXT NOT NULL,
ADD COLUMN     "shippingCountry" TEXT NOT NULL,
ADD COLUMN     "shippingName" TEXT NOT NULL,
ADD COLUMN     "shippingPostal" TEXT NOT NULL,
ADD COLUMN     "shippingProvince" TEXT NOT NULL,
ADD COLUMN     "shippingStreet" TEXT NOT NULL;
