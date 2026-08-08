"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleAvailabilitySlot = exports.deleteAvailabilitySlot = exports.updateAvailabilitySlot = exports.getAvailableSlotsForDate = exports.getAvailability = exports.addAvailability = exports.setAvailability = exports.getVendorDashboardStats = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const vendor_service_1 = require("../services/vendor.service");
const viewTracking_service_1 = require("../services/viewTracking.service");
const BadRequestError_1 = require("../errors/BadRequestError");
const getVendorDashboardStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can view vendor dashboard");
        }
        const stats = await vendor_service_1.VendorService.getDashboardStats(user.id);
        const viewStats = await viewTracking_service_1.ViewTrackingService.getVendorViewStats(user.id);
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
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_VENDOR_DASHBOARD', 'DASHBOARD', 'vendor', {
            totalProperties: stats.totalProperties.find((item) => item.TotalListing !== undefined)?.TotalListing || 0,
            totalViews: viewStats.summary.totalViews
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Vendor dashboard statistics retrieved successfully", dashboardData);
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorDashboardStats = getVendorDashboardStats;
const setAvailability = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can set availability");
        }
        const { slots } = req.body;
        if (!slots || !Array.isArray(slots) || slots.length === 0) {
            throw new BadRequestError_1.BadRequestError("Slots array is required");
        }
        // Parse dates
        const parsedSlots = slots.map((slot) => ({
            date: new Date(slot.date),
            startTime: slot.startTime,
            endTime: slot.endTime,
            isRecurring: slot.isRecurring || false,
            dayOfWeek: slot.dayOfWeek || null
        }));
        const availability = await vendor_service_1.VendorService.setAvailability(user.id, parsedSlots);
        await (0, activity_controller_1.logActivity)(user.id, 'SET_AVAILABILITY', 'AVAILABILITY', 'vendor', { slotCount: slots.length }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Availability set successfully", availability);
    }
    catch (error) {
        next(error);
    }
};
exports.setAvailability = setAvailability;
/**
 * Add availability for a single date
 */
const addAvailability = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can set availability");
        }
        const { date, startTime, endTime, isRecurring, dayOfWeek } = req.body;
        if (!date) {
            throw new BadRequestError_1.BadRequestError("Date is required");
        }
        const slot = {
            date: new Date(date),
            startTime,
            endTime,
            isRecurring: isRecurring || false,
            dayOfWeek: dayOfWeek || null
        };
        const availability = await vendor_service_1.VendorService.addAvailability(user.id, slot);
        await (0, activity_controller_1.logActivity)(user.id, 'ADD_AVAILABILITY', 'AVAILABILITY', 'vendor', { date }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Availability added successfully", availability);
    }
    catch (error) {
        next(error);
    }
};
exports.addAvailability = addAvailability;
/**
 * Get vendor availability with optional date range
 */
const getAvailability = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can view availability");
        }
        const { startDate, endDate } = req.query;
        let start, end;
        if (startDate) {
            start = new Date(startDate);
            if (isNaN(start.getTime())) {
                throw new BadRequestError_1.BadRequestError("Invalid startDate format. Use YYYY-MM-DD or ISO datetime");
            }
        }
        if (endDate) {
            end = new Date(endDate);
            if (isNaN(end.getTime())) {
                throw new BadRequestError_1.BadRequestError("Invalid endDate format. Use YYYY-MM-DD or ISO datetime");
            }
        }
        const availability = await vendor_service_1.VendorService.getAvailability(user.id, start, end);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_AVAILABILITY', 'AVAILABILITY', 'vendor', {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Availability retrieved successfully", availability);
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailability = getAvailability;
/**
 * Get available slots for a specific date (Public)
 */
const getAvailableSlotsForDate = async (req, res, next) => {
    try {
        const { vendorId } = req.params;
        const { date } = req.query;
        if (!date) {
            throw new BadRequestError_1.BadRequestError("Date query parameter is required");
        }
        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            throw new BadRequestError_1.BadRequestError("Invalid date format. Use ISO format (e.g., 2026-08-12)");
        }
        const slots = await vendor_service_1.VendorService.getAvailableSlotsForDate(vendorId, targetDate);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Available slots retrieved successfully", slots);
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailableSlotsForDate = getAvailableSlotsForDate;
const updateAvailabilitySlot = async (req, res, next) => {
    try {
        const user = req.user;
        const { slotId } = req.params;
        const data = req.body;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can update availability");
        }
        const updated = await vendor_service_1.VendorService.updateAvailabilitySlot(user.id, slotId, data);
        await (0, activity_controller_1.logActivity)(user.id, 'UPDATE_AVAILABILITY_SLOT', 'AVAILABILITY', slotId, { updates: Object.keys(data) }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Availability slot updated successfully", updated);
    }
    catch (error) {
        next(error);
    }
};
exports.updateAvailabilitySlot = updateAvailabilitySlot;
/**
 * Delete availability slot
 */
const deleteAvailabilitySlot = async (req, res, next) => {
    try {
        const user = req.user;
        const { slotId } = req.params;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can delete availability");
        }
        await vendor_service_1.VendorService.deleteAvailabilitySlot(user.id, slotId);
        await (0, activity_controller_1.logActivity)(user.id, 'DELETE_AVAILABILITY_SLOT', 'AVAILABILITY', slotId, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Availability slot deleted successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAvailabilitySlot = deleteAvailabilitySlot;
/**
 * Toggle availability slot
 */
const toggleAvailabilitySlot = async (req, res, next) => {
    try {
        const user = req.user;
        const { slotId } = req.params;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can toggle availability");
        }
        const updated = await vendor_service_1.VendorService.toggleAvailability(user.id, slotId);
        await (0, activity_controller_1.logActivity)(user.id, 'TOGGLE_AVAILABILITY_SLOT', 'AVAILABILITY', slotId, { isActive: updated.isActive }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Availability slot toggled successfully", updated);
    }
    catch (error) {
        next(error);
    }
};
exports.toggleAvailabilitySlot = toggleAvailabilitySlot;
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
