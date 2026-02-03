-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'VET_REQUEST';

-- CreateTable
CREATE TABLE "VetRequest" (
    "id" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VetRequest_vetId_idx" ON "VetRequest"("vetId");

-- CreateIndex
CREATE INDEX "VetRequest_companyId_idx" ON "VetRequest"("companyId");

-- CreateIndex
CREATE INDEX "VetRequest_adminId_idx" ON "VetRequest"("adminId");

-- CreateIndex
CREATE INDEX "VetRequest_status_idx" ON "VetRequest"("status");

-- AddForeignKey
ALTER TABLE "VetRequest" ADD CONSTRAINT "VetRequest_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetRequest" ADD CONSTRAINT "VetRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetRequest" ADD CONSTRAINT "VetRequest_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
