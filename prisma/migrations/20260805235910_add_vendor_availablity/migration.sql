-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "proposedDate" TIMESTAMP(3),
ADD COLUMN     "scheduledDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VendorAvailability" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "dayOfWeek" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorAvailability_vendorId_idx" ON "VendorAvailability"("vendorId");

-- CreateIndex
CREATE INDEX "VendorAvailability_date_idx" ON "VendorAvailability"("date");

-- CreateIndex
CREATE INDEX "VendorAvailability_isActive_idx" ON "VendorAvailability"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VendorAvailability_vendorId_date_startTime_endTime_key" ON "VendorAvailability"("vendorId", "date", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "VendorAvailability" ADD CONSTRAINT "VendorAvailability_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
