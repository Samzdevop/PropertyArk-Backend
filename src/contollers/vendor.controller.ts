
import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role } from "@prisma/client";
import { VendorService } from "../services/vendor.service";
import { ViewTrackingService } from "../services/viewTracking.service";


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

    // Get existing dashboard stats
    const stats = await VendorService.getDashboardStats(user.id);

    // Get view statistics
    const viewStats = await ViewTrackingService.getVendorViewStats(user.id);

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