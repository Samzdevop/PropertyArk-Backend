/*
  Warnings:

  - You are about to drop the column `guestFullName` on the `ShortletBooking` table. All the data in the column will be lost.
  - Added the required column `guestFirstName` to the `ShortletBooking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShortletBooking" DROP COLUMN "guestFullName",
ADD COLUMN     "guestFirstName" TEXT NOT NULL;
