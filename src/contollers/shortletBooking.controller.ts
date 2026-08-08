import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { ShortletBookingService } from "../services/shortletBooking.service";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role } from "@prisma/client";

export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    
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
      paymentMethod
    } = req.body;

    const booking = await ShortletBookingService.createBooking({
      propertyId,
      firstName,
      lastName,
      email,
      phone,
      adult,
      child: child || 0,
      checkInDate,
      checkOutDate,
      paymentMethod,
      userId: user?.id
    });

    if (user) {
      await logActivity(
        user.id,
        'CREATE_SHORTLET_BOOKING',
        'BOOKING',
        booking.id,
        {
          bookingNumber: booking.bookingNumber,
          propertyId,
          totalAmount: booking.totalAmount
        },
        req
      );
    }

    sendSuccessResponse(
      res,
      "Booking created successfully. Awaiting vendor approval.",
      booking,
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getVendorBookingStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can view booking stats");
    }

    const stats = await ShortletBookingService.getVendorBookingStats(user.id);

    await logActivity(
      user.id,
      'VIEW_BOOKING_STATS',
      'BOOKING',
      'stats',
      {
        total: stats.stats.total,
        pending: stats.stats.pending,
        upcoming: stats.stats.upcoming
      },
      req
    );

    sendSuccessResponse(res, "Booking stats retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};

export const approveBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can approve bookings");
    }

    const booking = await ShortletBookingService.approveBooking(
      bookingId as string,
      user.id
    );

    await logActivity(
      user.id,
      'APPROVE_BOOKING',
      'BOOKING',
      bookingId as string,
      {
        bookingNumber: booking.bookingNumber,
        status: booking.status
      },
      req
    );

    sendSuccessResponse(res, "Booking approved successfully", booking);
  } catch (error) {
    next(error);
  }
};

export const checkInGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can check-in guests");
    }

    const booking = await ShortletBookingService.checkInGuest(
      bookingId as string,
      user.id
    );

    await logActivity(
      user.id,
      'CHECK_IN_GUEST',
      'BOOKING',
      bookingId as string,
      {
        bookingNumber: booking.bookingNumber,
        status: booking.status
      },
      req
    );

    sendSuccessResponse(res, "Guest checked-in successfully", booking);
  } catch (error) {
    next(error);
  }
};

export const checkOutGuest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can check-out guests");
    }

    const booking = await ShortletBookingService.checkOutGuest(
      bookingId as string,
      user.id
    );

    await logActivity(
      user.id,
      'CHECK_OUT_GUEST',
      'BOOKING',
      bookingId as string,
      {
        bookingNumber: booking.bookingNumber,
        status: booking.status
      },
      req
    );

    sendSuccessResponse(res, "Guest checked-out successfully", booking);
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const user = req.user as any;

    const booking = await ShortletBookingService.cancelBooking(
      bookingId as string,
      user?.id,
      user?.role
    );

    await logActivity(
      user?.id || 'anonymous',
      'CANCEL_BOOKING',
      'BOOKING',
      bookingId as string,
      {
        bookingNumber: booking.bookingNumber,
        status: booking.status
      },
      req
    );

    sendSuccessResponse(res, "Booking cancelled successfully", booking);
  } catch (error) {
    next(error);
  }
};