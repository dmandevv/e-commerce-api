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
ALTER TABLE "order_items" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingCountry" TEXT,
ADD COLUMN     "shippingName" TEXT,
ADD COLUMN     "shippingPostal" TEXT,
ADD COLUMN     "shippingProvince" TEXT,
ADD COLUMN     "shippingStreet" TEXT;
