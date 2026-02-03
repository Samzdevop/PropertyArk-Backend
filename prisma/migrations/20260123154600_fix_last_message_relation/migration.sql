/*
  Warnings:

  - You are about to drop the `conversations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `messages` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[licenseNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallParticipantStatus" AS ENUM ('RINGING', 'JOINED', 'DECLINED', 'LEFT', 'MISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageType" ADD VALUE 'AUDIO';
ALTER TYPE "MessageType" ADD VALUE 'VIDEO';
ALTER TYPE "MessageType" ADD VALUE 'LOCATION';
ALTER TYPE "MessageType" ADD VALUE 'CONTACT';
ALTER TYPE "MessageType" ADD VALUE 'SYSTEM';

-- DropForeignKey
ALTER TABLE "conversation_participants" DROP CONSTRAINT "conversation_participants_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_senderId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availability" TEXT[],
ADD COLUMN     "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "certifications" TEXT[],
ADD COLUMN     "consultationFee" DOUBLE PRECISION,
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "specializations" TEXT[],
ADD COLUMN     "totalRatings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "yearsOfExperience" INTEGER;

-- DropTable
DROP TABLE "conversations";

-- DropTable
DROP TABLE "messages";

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "lastMessageId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "groupName" TEXT,
    "groupAdminId" TEXT,
    "groupImage" TEXT,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "fileSize" DOUBLE PRECISION,
    "fileName" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "messageId" TEXT NOT NULL,
    "parentMessageId" TEXT,
    "encryptedKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "callType" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallParticipant" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CallParticipantStatus" NOT NULL DEFAULT 'RINGING',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MessageDeletions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MessageDeletions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_lastMessageId_key" ON "Conversation"("lastMessageId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_messageId_key" ON "Message"("messageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_messageId_userId_key" ON "Reaction"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageDelivery_messageId_recipientId_key" ON "MessageDelivery"("messageId", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "Call_callId_key" ON "Call"("callId");

-- CreateIndex
CREATE INDEX "Call_conversationId_idx" ON "Call"("conversationId");

-- CreateIndex
CREATE INDEX "Call_initiatorId_idx" ON "Call"("initiatorId");

-- CreateIndex
CREATE INDEX "Call_status_idx" ON "Call"("status");

-- CreateIndex
CREATE INDEX "Call_startedAt_idx" ON "Call"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallParticipant_callId_userId_key" ON "CallParticipant"("callId", "userId");

-- CreateIndex
CREATE INDEX "_MessageDeletions_B_index" ON "_MessageDeletions"("B");

-- CreateIndex
CREATE UNIQUE INDEX "User_licenseNumber_key" ON "User"("licenseNumber");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_lastMessageId_fkey" FOREIGN KEY ("lastMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("callId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageDeletions" ADD CONSTRAINT "_MessageDeletions_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageDeletions" ADD CONSTRAINT "_MessageDeletions_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
