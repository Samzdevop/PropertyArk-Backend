-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "bulkId" TEXT,
ADD COLUMN     "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "isBulk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "BulkNotification" (
    "id" TEXT NOT NULL,
    "bulkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "priority" "NotificationPriority" NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "targetUserIds" TEXT[],
    "targetRoles" TEXT[],
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentBy" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkNotification_bulkId_key" ON "BulkNotification"("bulkId");

-- CreateIndex
CREATE INDEX "BulkNotification_bulkId_idx" ON "BulkNotification"("bulkId");

-- CreateIndex
CREATE INDEX "BulkNotification_sentAt_idx" ON "BulkNotification"("sentAt");

-- CreateIndex
CREATE INDEX "BulkNotification_targetAudience_idx" ON "BulkNotification"("targetAudience");

-- CreateIndex
CREATE INDEX "Notification_bulkId_idx" ON "Notification"("bulkId");

-- CreateIndex
CREATE INDEX "Notification_channel_idx" ON "Notification"("channel");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");
