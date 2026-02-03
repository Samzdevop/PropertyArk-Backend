/*
  Warnings:

  - You are about to drop the column `messageId` on the `Message` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Message_messageId_key";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "messageId";
