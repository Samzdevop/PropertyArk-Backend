-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('FARM_VISIT', 'MEETING');

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "visitType" "VisitType" NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "relatedFarm" TEXT NOT NULL,
    "relatedAnimal" TEXT,
    "purpose" TEXT NOT NULL,
    "setReminder" BOOLEAN NOT NULL DEFAULT false,
    "notifyFarmStaff" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmVisit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "relatedFarm" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "keyPersonnelMet" TEXT NOT NULL,
    "animalExamined" TEXT NOT NULL,
    "farmObservation" TEXT NOT NULL,
    "farmRecommendation" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_recordedById_idx" ON "Appointment"("recordedById");

-- CreateIndex
CREATE INDEX "FarmVisit_companyId_idx" ON "FarmVisit"("companyId");

-- CreateIndex
CREATE INDEX "FarmVisit_date_idx" ON "FarmVisit"("date");

-- CreateIndex
CREATE INDEX "FarmVisit_recordedById_idx" ON "FarmVisit"("recordedById");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmVisit" ADD CONSTRAINT "FarmVisit_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
