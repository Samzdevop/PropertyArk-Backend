-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'TWICE_DAILY', 'EVERY_OTHER_DAY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'AS_NEEDED');

-- CreateEnum
CREATE TYPE "AdministrationRoutine" AS ENUM ('ORAL', 'INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRAVENOUS', 'TOPICAL', 'INTRAMAMMARY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'FOLLOW_UP_REMINDER', 'TREATMENT_REMINDER', 'ANNOUNCEMENT', 'SYSTEM_ALERT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateTable
CREATE TABLE "PrescribedTreatment" (
    "id" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "treatmentType" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "routine" "AdministrationRoutine" NOT NULL,
    "additionalNotes" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescribedTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "prescribedTreatmentId" TEXT,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "relatedAnimalId" TEXT NOT NULL,
    "relatedFarm" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "additionalNotes" TEXT,
    "setReminder" BOOLEAN NOT NULL DEFAULT false,
    "notifyFarmStaff" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentReminder" (
    "id" TEXT NOT NULL,
    "prescribedTreatmentId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpReminder" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "recipientId" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrescribedTreatment_livestockId_idx" ON "PrescribedTreatment"("livestockId");

-- CreateIndex
CREATE INDEX "PrescribedTreatment_isActive_idx" ON "PrescribedTreatment"("isActive");

-- CreateIndex
CREATE INDEX "PrescribedTreatment_startDate_idx" ON "PrescribedTreatment"("startDate");

-- CreateIndex
CREATE INDEX "FollowUp_date_idx" ON "FollowUp"("date");

-- CreateIndex
CREATE INDEX "FollowUp_relatedAnimalId_idx" ON "FollowUp"("relatedAnimalId");

-- CreateIndex
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

-- CreateIndex
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_sentAt_idx" ON "Notification"("sentAt");

-- AddForeignKey
ALTER TABLE "PrescribedTreatment" ADD CONSTRAINT "PrescribedTreatment_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescribedTreatment" ADD CONSTRAINT "PrescribedTreatment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_prescribedTreatmentId_fkey" FOREIGN KEY ("prescribedTreatmentId") REFERENCES "PrescribedTreatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_relatedAnimalId_fkey" FOREIGN KEY ("relatedAnimalId") REFERENCES "Livestock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentReminder" ADD CONSTRAINT "TreatmentReminder_prescribedTreatmentId_fkey" FOREIGN KEY ("prescribedTreatmentId") REFERENCES "PrescribedTreatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpReminder" ADD CONSTRAINT "FollowUpReminder_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
