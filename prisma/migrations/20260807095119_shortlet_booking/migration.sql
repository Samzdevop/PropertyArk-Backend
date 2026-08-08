-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateTable
CREATE TABLE "ShortletBooking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "guestFullName" TEXT NOT NULL,
    "guestLastName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT,
    "adultCount" INTEGER NOT NULL DEFAULT 1,
    "childCount" INTEGER NOT NULL DEFAULT 0,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "totalNights" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "ShortletBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortletBooking_bookingNumber_key" ON "ShortletBooking"("bookingNumber");

-- CreateIndex
CREATE INDEX "ShortletBooking_propertyId_idx" ON "ShortletBooking"("propertyId");

-- CreateIndex
CREATE INDEX "ShortletBooking_vendorId_idx" ON "ShortletBooking"("vendorId");

-- CreateIndex
CREATE INDEX "ShortletBooking_status_idx" ON "ShortletBooking"("status");

-- CreateIndex
CREATE INDEX "ShortletBooking_checkInDate_idx" ON "ShortletBooking"("checkInDate");

-- CreateIndex
CREATE INDEX "ShortletBooking_checkOutDate_idx" ON "ShortletBooking"("checkOutDate");

-- CreateIndex
CREATE INDEX "ShortletBooking_guestEmail_idx" ON "ShortletBooking"("guestEmail");

-- AddForeignKey
ALTER TABLE "ShortletBooking" ADD CONSTRAINT "ShortletBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortletBooking" ADD CONSTRAINT "ShortletBooking_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortletBooking" ADD CONSTRAINT "ShortletBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
