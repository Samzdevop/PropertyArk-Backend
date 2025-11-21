-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "companyId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notes_companyId_idx" ON "notes"("companyId");

-- CreateIndex
CREATE INDEX "notes_folderName_idx" ON "notes"("folderName");

-- CreateIndex
CREATE INDEX "notes_date_idx" ON "notes"("date");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
