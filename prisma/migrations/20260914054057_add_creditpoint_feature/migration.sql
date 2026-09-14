-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'PROPERTY_CREATION', 'FEATURE_PROPERTY', 'REFUND', 'ADMIN_ADJUSTMENT', 'EXPIRY');

-- CreateEnum
CREATE TYPE "CreditTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'ABANDONED');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "featuredAt" TIMESTAMP(3),
ADD COLUMN     "featuredBy" TEXT,
ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creditPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditPointsPurchased" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditPointsUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "status" "CreditTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "points" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentReference" TEXT,
    "paymentStatus" "PaymentStatus",
    "paymentMethod" TEXT,
    "propertyId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyCreatorId" TEXT,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPointSettings" (
    "id" TEXT NOT NULL,
    "newVendorBonusPoints" INTEGER NOT NULL DEFAULT 10,
    "newVendorBonusExpiryDays" INTEGER NOT NULL DEFAULT 30,
    "propertyCreationCost" INTEGER NOT NULL DEFAULT 5,
    "featurePropertyCost" INTEGER NOT NULL DEFAULT 10,
    "featurePropertyDurationDays" INTEGER NOT NULL DEFAULT 30,
    "minimumPurchasePoints" INTEGER NOT NULL DEFAULT 10,
    "pricePerPoint" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPointSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPurchase" (
    "id" TEXT NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paystackReference" TEXT NOT NULL,
    "paystackAccessCode" TEXT,
    "paystackAuthorizationUrl" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "creditTransactionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_transactionNumber_key" ON "CreditTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_propertyCreatorId_idx" ON "CreditTransaction"("propertyCreatorId");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");

-- CreateIndex
CREATE INDEX "CreditTransaction_status_idx" ON "CreditTransaction"("status");

-- CreateIndex
CREATE INDEX "CreditTransaction_paymentReference_idx" ON "CreditTransaction"("paymentReference");

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_expiresAt_idx" ON "CreditTransaction"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPurchase_purchaseNumber_key" ON "CreditPurchase"("purchaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPurchase_paystackReference_key" ON "CreditPurchase"("paystackReference");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPurchase_creditTransactionId_key" ON "CreditPurchase"("creditTransactionId");

-- CreateIndex
CREATE INDEX "CreditPurchase_userId_idx" ON "CreditPurchase"("userId");

-- CreateIndex
CREATE INDEX "CreditPurchase_paystackReference_idx" ON "CreditPurchase"("paystackReference");

-- CreateIndex
CREATE INDEX "CreditPurchase_paymentStatus_idx" ON "CreditPurchase"("paymentStatus");

-- CreateIndex
CREATE INDEX "CreditPurchase_createdAt_idx" ON "CreditPurchase"("createdAt");

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_propertyCreatorId_fkey" FOREIGN KEY ("propertyCreatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_creditTransactionId_fkey" FOREIGN KEY ("creditTransactionId") REFERENCES "CreditTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
