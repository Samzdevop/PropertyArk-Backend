import prisma from "../prisma";
import { BookingStatus, PaymentMethod, PropertyListingStatus } from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import Logger from "../config/logger";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";
import { MailInterface } from "../interfaces/mail.interfaces";
import { formatDateForDB, parseDate } from "../utils/date.utils";

export class ShortletBookingService {

  private static generateBookingNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BKG-${year}-${random}`;
  }

  private static calculateTotalNights(checkIn: Date, checkOut: Date): number {
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

   static async createBooking(data: {
    propertyId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    adult: number;
    child: number;
    checkInDate: string;
    checkOutDate: string;
    paymentMethod: 'CASH' | 'TRANSFER';
    userId?: string;
  }): Promise<any> {
    const {
      propertyId,
      firstName,
      lastName,
      email,
      phone,
      adult,
      child,
      checkInDate,
      checkOutDate,
      paymentMethod,
      userId
    } = data;

    // Validate property exists and is a shortlet
    const property = await prisma.property.findUnique({
      where: { 
        id: propertyId,
        listingType: 'FOR_SHORTLET',
        listingStatus: PropertyListingStatus.ACTIVE
      },
      include: {
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found or not available for shortlet");
    }

    if (!property.vendor) {
      throw new BadRequestError("Property has no vendor associated");
    }

    // ✅ Parse dates using the new utility (supports both formats)
    let checkIn: Date;
    let checkOut: Date;

    try {
      checkIn = parseDate(checkInDate);
      checkOut = parseDate(checkOutDate);
    } catch (error: any) {
      throw new BadRequestError(`Invalid date format: ${error.message}`);
    }

    // Validate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Set to start of day for comparison
    checkIn = formatDateForDB(checkIn);
    checkOut = formatDateForDB(checkOut);

    if (checkIn < today) {
      throw new BadRequestError("Check-in date cannot be in the past");
    }

    if (checkOut <= checkIn) {
      throw new BadRequestError("Check-out date must be after check-in date");
    }

    // Validate guest count
    if (adult < 1) {
      throw new BadRequestError("At least 1 adult is required");
    }

    if (child < 0) {
      throw new BadRequestError("Child count cannot be negative");
    }

    // Calculate total nights and amount
    const totalNights = this.calculateTotalNights(checkIn, checkOut);
    const nightlyRate = property.shortletAmount || 0;
    const totalAmount = nightlyRate * totalNights;

    if (totalAmount <= 0) {
      throw new BadRequestError("Invalid property pricing");
    }

    // Check for date conflicts
    const conflictingBookings = await prisma.shortletBooking.findMany({
      where: {
        propertyId,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.CHECKED_IN]
        },
        OR: [
          {
            AND: [
              { checkInDate: { lte: checkIn } },
              { checkOutDate: { gt: checkIn } }
            ]
          },
          {
            AND: [
              { checkInDate: { lt: checkOut } },
              { checkOutDate: { gte: checkOut } }
            ]
          },
          {
            AND: [
              { checkInDate: { gte: checkIn } },
              { checkOutDate: { lte: checkOut } }
            ]
          }
        ]
      }
    });

    if (conflictingBookings.length > 0) {
      throw new BadRequestError("Property is already booked for the selected dates");
    }

    // Create booking
    const booking = await prisma.shortletBooking.create({
      data: {
        bookingNumber: this.generateBookingNumber(),
        propertyId,
        vendorId: property.vendorId,
        guestFirstName: firstName,
        guestLastName: lastName,
        guestEmail: email,
        guestPhone: phone || null,
        adultCount: adult,
        childCount: child || 0,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalNights,
        totalAmount,
        paymentMethod: paymentMethod as PaymentMethod,
        status: BookingStatus.PENDING,
        userId: userId || null
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            shortletAmount: true,
            media: {
              take: 1,
              where: { isPrimary: true },
              select: { url: true }
            }
          }
        },
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    // Send notifications
    await this.sendBookingNotifications(booking);

    Logger.info(`Booking ${booking.bookingNumber} created for property ${propertyId}`);
    return booking;
  }

  private static async sendBookingNotifications(booking: any): Promise<void> {
    try {
      // Email to vendor
      if (booking.vendor.email) {
        const vendorEmailHtml = await render('booking-notification-vendor', {
          vendorName: booking.vendor.firstName,
          bookingNumber: booking.bookingNumber,
          guestName: booking.guestFirstName,
          propertyName: booking.property.name,
          checkInDate: new Date(booking.checkInDate).toLocaleDateString(),
          checkOutDate: new Date(booking.checkOutDate).toLocaleDateString(),
          totalNights: booking.totalNights,
          totalAmount: booking.totalAmount,
          guestEmail: booking.guestEmail,
          guestPhone: booking.guestPhone || 'Not provided',
          dashboardUrl: `${process.env.FRONTEND_URL}/vendor/bookings`,
          currentYear: new Date().getFullYear()
        });

        const vendorMailOptions: MailInterface = {
          to: booking.vendor.email,
          from: `"Property Management" ${process.env.SENDER_EMAIL}`,
          subject: `New Booking Request: ${booking.bookingNumber}`,
          text: `You have a new booking request for ${booking.property.name}`,
          html: vendorEmailHtml
        };

        await sendGraphMail(vendorMailOptions);
        Logger.info(`Booking notification sent to vendor ${booking.vendor.email}`);
      }

      // Email to guest
      const guestEmailHtml = await render('booking-confirmation-guest', {
        guestName: booking.guestFirstName,
        bookingNumber: booking.bookingNumber,
        propertyName: booking.property.name,
        propertyAddress: booking.property.address,
        propertyCity: booking.property.city,
        propertyState: booking.property.state,
        checkInDate: new Date(booking.checkInDate).toLocaleDateString(),
        checkOutDate: new Date(booking.checkOutDate).toLocaleDateString(),
        totalNights: booking.totalNights,
        totalAmount: booking.totalAmount,
        paymentMethod: booking.paymentMethod,
        currentYear: new Date().getFullYear()
      });

      const guestMailOptions: MailInterface = {
        to: booking.guestEmail,
        from: `"Property Management" ${process.env.SENDER_EMAIL}`,
        subject: `Booking Confirmation: ${booking.bookingNumber}`,
        text: `Your booking for ${booking.property.name} has been received`,
        html: guestEmailHtml
      };

      await sendGraphMail(guestMailOptions);
      Logger.info(`Booking confirmation sent to guest ${booking.guestEmail}`);

      // In-app notification for vendor
      await prisma.notification.create({
        data: {
          userId: booking.vendorId,
          type: 'GENERAL',
          title: 'New Booking Request',
          message: `${booking.guestFirstName} has requested to book "${booking.property.name}" for ${booking.totalNights} nights`,
          data: {
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            propertyId: booking.propertyId
          }
        }
      });

    } catch (error) {
      Logger.error('Failed to send booking notifications:', error);
    }
  }

  static async getVendorBookingStats(vendorId: string): Promise<any> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const bookings = await prisma.shortletBooking.findMany({
      where: { vendorId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            shortletAmount: true,
            media: {
              take: 1,
              where: { isPrimary: true },
              select: { url: true }
            }
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate stats
    const totalBookings = bookings.length;
    const pendingBookings = bookings.filter(b => b.status === BookingStatus.PENDING).length;
    
    const upcomingBookings = bookings.filter(b => 
      (b.status === BookingStatus.APPROVED || b.status === BookingStatus.CHECKED_IN) &&
      new Date(b.checkInDate) >= now
    ).length;

    const activeGuests = bookings.filter(b => {
      if (b.status !== BookingStatus.CHECKED_IN) return false;
      const checkOut = new Date(b.checkOutDate);
      return checkOut >= now;
    }).length;

    const completedBookings = bookings.filter(b => {
      if (b.status === BookingStatus.CHECKED_OUT) return true;
      if (b.status === BookingStatus.CHECKED_IN) {
        const checkOut = new Date(b.checkOutDate);
        return checkOut < now;
      }
      return false;
    }).length;

    // Format bookings for response
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      guestName: booking.guestFirstName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      property: {
        id: booking.property.id,
        name: booking.property.name,
        address: booking.property.address,
        city: booking.property.city,
        state: booking.property.state,
        image: booking.property.media[0]?.url || null
      },
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      totalNights: booking.totalNights,
      totalAmount: booking.totalAmount,
      paymentMethod: booking.paymentMethod,
      status: booking.status,
      guestCount: {
        adult: booking.adultCount,
        child: booking.childCount
      },
      createdAt: booking.createdAt,
      approvedAt: booking.approvedAt
    }));

    return {
      stats: {
        total: totalBookings,
        pending: pendingBookings,
        upcoming: upcomingBookings,
        activeGuests: activeGuests,
        completed: completedBookings
      },
      bookings: formattedBookings
    };
  }

  static async approveBooking(bookingId: string, vendorId: string): Promise<any> {
    const booking = await prisma.shortletBooking.findUnique({
      where: { id: bookingId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            vendorId: true
          }
        },
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    if (booking.vendorId !== vendorId) {
      throw new BadRequestError("You don't have permission to approve this booking");
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestError(`Booking is already ${booking.status.toLowerCase()}`);
    }

    const updatedBooking = await prisma.shortletBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: vendorId
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            shortletAmount: true
          }
        },
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    await this.sendApprovalNotifications(updatedBooking);

    Logger.info(`Booking ${booking.bookingNumber} approved by vendor ${vendorId}`);
    return updatedBooking;
  }

  private static async sendApprovalNotifications(booking: any): Promise<void> {
    try {
      // Email to guest
      const guestEmailHtml = await render('booking-approved-guest', {
        guestName: booking.guestFirstName,
        bookingNumber: booking.bookingNumber,
        propertyName: booking.property.name,
        propertyAddress: booking.property.address,
        propertyCity: booking.property.city,
        propertyState: booking.property.state,
        checkInDate: new Date(booking.checkInDate).toLocaleDateString(),
        checkOutDate: new Date(booking.checkOutDate).toLocaleDateString(),
        totalNights: booking.totalNights,
        totalAmount: booking.totalAmount,
        currentYear: new Date().getFullYear()
      });

      const guestMailOptions: MailInterface = {
        to: booking.guestEmail,
        from: `"Property Management" ${process.env.SENDER_EMAIL}`,
        subject: `Booking Approved: ${booking.bookingNumber}`,
        text: `Your booking for ${booking.property.name} has been approved`,
        html: guestEmailHtml
      };

      await sendGraphMail(guestMailOptions);
      Logger.info(`Booking approval email sent to guest ${booking.guestEmail}`);

      // In-app notification for guest (if authenticated)
      if (booking.userId) {
        await prisma.notification.create({
          data: {
            userId: booking.userId,
            type: 'GENERAL',
            title: 'Booking Approved',
            message: `Your booking for "${booking.property.name}" has been approved!`,
            data: {
              bookingId: booking.id,
              bookingNumber: booking.bookingNumber,
              propertyId: booking.propertyId
            }
          }
        });
      }

    } catch (error) {
      Logger.error('Failed to send approval notifications:', error);
    }
  }

  static async checkInGuest(bookingId: string, vendorId: string): Promise<any> {
    const booking = await prisma.shortletBooking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    if (booking.vendorId !== vendorId) {
      throw new BadRequestError("You don't have permission to check-in this booking");
    }

    if (booking.status !== BookingStatus.APPROVED) {
      throw new BadRequestError(`Booking must be approved before check-in`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.checkInDate);
    checkInDate.setHours(0, 0, 0, 0);

    if (checkInDate > today) {
      throw new BadRequestError("Cannot check-in before the check-in date");
    }

    const updatedBooking = await prisma.shortletBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CHECKED_IN,
        checkedInAt: new Date()
      }
    });

    Logger.info(`Guest checked-in for booking ${booking.bookingNumber}`);
    return updatedBooking;
  }

  static async checkOutGuest(bookingId: string, vendorId: string): Promise<any> {
    const booking = await prisma.shortletBooking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    if (booking.vendorId !== vendorId) {
      throw new BadRequestError("You don't have permission to check-out this booking");
    }

    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestError("Guest must be checked-in before check-out");
    }

    const updatedBooking = await prisma.shortletBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CHECKED_OUT,
        checkedOutAt: new Date()
      }
    });

    Logger.info(`Guest checked-out for booking ${booking.bookingNumber}`);
    return updatedBooking;
  }

  static async cancelBooking(bookingId: string, userId: string, role: string): Promise<any> {
    const booking = await prisma.shortletBooking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    const isAdmin = role === 'ADMIN';
    const isVendor = booking.vendorId === userId;
    const isUser = booking.userId === userId;

    if (!isAdmin && !isVendor && !isUser) {
      throw new BadRequestError("You don't have permission to cancel this booking");
    }

    if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestError("Cannot cancel a booking that has been checked-in or checked-out");
    }

    const updatedBooking = await prisma.shortletBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date()
      }
    });

    Logger.info(`Booking ${booking.bookingNumber} cancelled by ${userId}`);
    return updatedBooking;
  }
}