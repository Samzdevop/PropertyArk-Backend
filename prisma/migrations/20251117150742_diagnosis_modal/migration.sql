-- CreateEnum
CREATE TYPE "DiagnosisSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'CRITICAL', 'CHRONIC');

-- CreateEnum
CREATE TYPE "DiagnosisPrognosis" AS ENUM ('GOOD', 'FAIR', 'GUARDED', 'POOR');

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "labTests" TEXT,
    "severity" "DiagnosisSeverity" NOT NULL DEFAULT 'MILD',
    "prognosis" "DiagnosisPrognosis" NOT NULL DEFAULT 'GOOD',
    "observations" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Diagnosis_livestockId_idx" ON "Diagnosis"("livestockId");

-- CreateIndex
CREATE INDEX "Diagnosis_date_idx" ON "Diagnosis"("date");

-- CreateIndex
CREATE INDEX "Diagnosis_severity_idx" ON "Diagnosis"("severity");

-- CreateIndex
CREATE INDEX "Diagnosis_prognosis_idx" ON "Diagnosis"("prognosis");

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
