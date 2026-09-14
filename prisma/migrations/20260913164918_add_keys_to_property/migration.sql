-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "cancellationPolicy" TEXT,
ADD COLUMN     "checkInTime" TEXT,
ADD COLUMN     "checkOutTime" TEXT,
ADD COLUMN     "houseRules" JSONB;
