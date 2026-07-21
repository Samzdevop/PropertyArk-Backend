"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVendorDashboardStats = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const vendor_service_1 = require("../services/vendor.service");
const viewTracking_service_1 = require("../services/viewTracking.service");
const getVendorDashboardStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can view vendor dashboard");
        }
        // Get existing dashboard stats
        const stats = await vendor_service_1.VendorService.getDashboardStats(user.id);
        // Get view statistics
        const viewStats = await viewTracking_service_1.ViewTrackingService.getVendorViewStats(user.id);
        // Merge view stats into the dashboard response
        const dashboardData = {
            ...stats,
            viewSummary: {
                totalViews: viewStats.summary.totalViews,
                totalInquiries: viewStats.summary.totalInquiries,
                todayViews: viewStats.summary.todayViews,
                weeklyViews: viewStats.summary.weeklyViews,
                topProperties: viewStats.topProperties
            },
            // Override listingPerformance with view data
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
