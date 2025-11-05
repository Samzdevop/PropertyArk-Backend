-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "livestockId" TEXT;

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_livestockId_idx" ON "Task"("livestockId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
