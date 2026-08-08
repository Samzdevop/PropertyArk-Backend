
import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role } from "@prisma/client";
import { VendorService } from "../services/vendor.service";
import { ViewTrackingService } from "../services/viewTracking.service";
import { BadRequestError } from "../errors/BadRequestError";


export const getVendorDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can view vendor dashboard");
    }

    const stats = await VendorService.getDashboardStats(user.id);
    const viewStats = await ViewTrackingService.getVendorViewStats(user.id);
    const dashboardData = {
      ...stats,
      viewSummary: {
        totalViews: viewStats.summary.totalViews,
        totalInquiries: viewStats.summary.totalInquiries,
        todayViews: viewStats.summary.todayViews,
        weeklyViews: viewStats.summary.weeklyViews,
        topProperties: viewStats.topProperties
      },
      listingPerformance: viewStats.weeklyPerformance
    };

    await logActivity(
      user.id,
      'VIEW_VENDOR_DASHBOARD',
      'DASHBOARD',
      'vendor',
      {
        totalProperties: stats.totalProperties.find((item: any) => item.TotalListing !== undefined)?.TotalListing || 0,
        totalViews: viewStats.summary.totalViews
      },
      req
    );

    sendSuccessResponse(res, "Vendor dashboard statistics retrieved successfully", dashboardData);
  } catch (error) {
    next(error);
  }
};


export const setAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can set availability");
    }

    const { slots } = req.body;

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      throw new BadRequestError("Slots array is required");
    }

    // Parse dates
    const parsedSlots = slots.map((slot: any) => ({
      date: new Date(slot.date),
      startTime: slot.startTime,
      endTime: slot.endTime,
      isRecurring: slot.isRecurring || false,
      dayOfWeek: slot.dayOfWeek || null
    }));

    const availability = await VendorService.setAvailability(
      user.id,
      parsedSlots
    );

    await logActivity(
      user.id,
      'SET_AVAILABILITY',
      'AVAILABILITY',
      'vendor',
      { slotCount: slots.length },
      req
    );

    sendSuccessResponse(res, "Availability set successfully", availability);
  } catch (error) {
    next(error);
  }
};

/**
 * Add availability for a single date
 */
export const addAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can set availability");
    }

    const { date, startTime, endTime, isRecurring, dayOfWeek } = req.body;

    if (!date) {
      throw new BadRequestError("Date is required");
    }

    const slot = {
      date: new Date(date),
      startTime,
      endTime,
      isRecurring: isRecurring || false,
      dayOfWeek: dayOfWeek || null
    };

    const availability = await VendorService.addAvailability(
      user.id,
      slot
    );

    await logActivity(
      user.id,
      'ADD_AVAILABILITY',
      'AVAILABILITY',
      'vendor',
      { date },
      req
    );

    sendSuccessResponse(res, "Availability added successfully", availability);
  } catch (error) {
    next(error);
  }
};

/**
 * Get vendor availability with optional date range
 */
export const getAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can view availability");
    }

    const { startDate, endDate } = req.query;

    let start, end;
    if (startDate) {
      start = new Date(startDate as string);
      if (isNaN(start.getTime())) {
        throw new BadRequestError("Invalid startDate format. Use YYYY-MM-DD or ISO datetime");
      }
    }
    if (endDate) {
      end = new Date(endDate as string);
       if (isNaN(end.getTime())) {
        throw new BadRequestError("Invalid endDate format. Use YYYY-MM-DD or ISO datetime");
      }
    }

    const availability = await VendorService.getAvailability(
      user.id,
      start,
      end
    );

    await logActivity(
      user.id,
      'VIEW_AVAILABILITY',
      'AVAILABILITY',
      'vendor',
      {},
      req
    );

    sendSuccessResponse(res, "Availability retrieved successfully", availability);
  } catch (error) {
    next(error);
  }
};

/**
 * Get available slots for a specific date (Public)
 */
export const getAvailableSlotsForDate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { vendorId } = req.params;
    const { date } = req.query;

    if (!date) {
      throw new BadRequestError("Date query parameter is required");
    }

    const targetDate = new Date(date as string);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestError("Invalid date format. Use ISO format (e.g., 2026-08-12)");
    }

    const slots = await VendorService.getAvailableSlotsForDate(
      vendorId as string,
      targetDate
    );

    sendSuccessResponse(res, "Available slots retrieved successfully", slots);
  } catch (error) {
    next(error);
  }
};


export const updateAvailabilitySlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { slotId } = req.params;
    const data = req.body;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can update availability");
    }

    const updated = await VendorService.updateAvailabilitySlot(
      user.id,
      slotId as string,
      data
    );

    await logActivity(
      user.id,
      'UPDATE_AVAILABILITY_SLOT',
      'AVAILABILITY',
      slotId as string,
      { updates: Object.keys(data) },
      req
    );

    sendSuccessResponse(res, "Availability slot updated successfully", updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete availability slot
 */
export const deleteAvailabilitySlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { slotId } = req.params;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can delete availability");
    }

    await VendorService.deleteAvailabilitySlot(user.id, slotId as string);

    await logActivity(
      user.id,
      'DELETE_AVAILABILITY_SLOT',
      'AVAILABILITY',
      slotId as string,
      {},
      req
    );

    sendSuccessResponse(res, "Availability slot deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle availability slot
 */
export const toggleAvailabilitySlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { slotId } = req.params;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can toggle availability");
    }

    const updated = await VendorService.toggleAvailability(
      user.id,
      slotId as string
    );

    await logActivity(
      user.id,
      'TOGGLE_AVAILABILITY_SLOT',
      'AVAILABILITY',
      slotId as string,
      { isActive: updated.isActive },
      req
    );

    sendSuccessResponse(res, "Availability slot toggled successfully", updated);
  } catch (error) {
    next(error);
  }
};







// import { NextFunction, Request, Response } from "express";
// import { sendSuccessResponse } from "../utils/sendSuccessResponse";
// import { logActivity } from "./activity.controller";
// import { ForbiddenError } from "../errors/ForbiddenError";
// import { Role } from "@prisma/client";
// import { VendorService } from "../services/vendor.service";
// import { ViewTrackingService } from "../services/viewTracking.service";

// /**
//  * Get vendor dashboard statistics
//  */
// export const getVendorDashboardStats = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = req.user as any;

//     if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
//       throw new ForbiddenError("Only vendors and admins can view vendor dashboard");
//     }

//     const stats = await VendorService.getDashboardStats(user.id);
//      const viewStats = await ViewTrackingService.getVendorViewStats(user.id);

//     await logActivity(
//       user.id,
//       'VIEW_VENDOR_DASHBOARD',
//       'DASHBOARD',
//       'vendor',
//       {
//         totalProperties: stats.totalProperties.find((item: any) => item.TotalListing !== undefined)?.TotalListing || 0,
//         totalViews: viewStats.totalViews
//       },
//       req
//     );

//     sendSuccessResponse(res, "Vendor dashboard statistics retrieved successfully", { ...stats, ...viewStats });
//   } catch (error) {
//     next(error);
//   }
// };