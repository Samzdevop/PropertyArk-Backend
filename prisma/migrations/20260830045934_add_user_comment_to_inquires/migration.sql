-- CreateEnum
CREATE TYPE "SatisfactionStatus" AS ENUM ('SATISFIED', 'NOT_SATISFIED', 'OTHERS');

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "satisfactionComment" TEXT,
ADD COLUMN     "satisfactionStatus" "SatisfactionStatus";
