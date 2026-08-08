import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { AdminDashboardService } from "../services/adminDashboard.service";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role } from "@prisma/client";
import { attachBaseUrlUploads } from "../utils/attachBaseUrl.utils";
import { serializeDates } from "../utils/serialize.utils";


export const getNINStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view NIN statistics");
    }

    const stats = await AdminDashboardService.getNINStats();

    await logActivity(
      user.id,
      'VIEW_NIN_STATS',
      'NIN',
      'stats',
      {
        pending: stats.stats.pending,
        verified: stats.stats.verified,
        rejected: stats.stats.rejected
      },
      req
    );

    sendSuccessResponse(res, "NIN statistics retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};


export const getPropertyManagementStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view property management statistics");
    }

    const { page = 1, limit = 20, status, listingType, search } = req.query;

    const result = await AdminDashboardService.getPropertyManagementStats(
      Number(page),
      Number(limit),
      {
        status: status as any,
        listingType: listingType as string,
        search: search as string
      }
    );

    // Attach base URLs to media
    const propertiesWithUrls = attachBaseUrlUploads(
      serializeDates(result.properties),
      req
    );

    await logActivity(
      user.id,
      'VIEW_PROPERTY_MANAGEMENT_STATS',
      'PROPERTY',
      'stats',
      {
        totalListings: result.stats.totalListings,
        pendingReviews: result.stats.pendingReviews,
        activeListings: result.stats.activeListings
      },
      req
    );

    sendSuccessResponse(res, "Property management statistics retrieved successfully", {
      stats: result.stats,
      properties: propertiesWithUrls,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};


export const getAdminDashboardOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view the dashboard");
    }

    const dashboardData = await AdminDashboardService.getAdminDashboardOverview();
    const propertiesWithUrls = attachBaseUrlUploads(
      serializeDates(dashboardData.properties),
      req
    );

    await logActivity(
      user.id,
      'VIEW_ADMIN_DASHBOARD',
      'DASHBOARD',
      'admin',
      {
        totalUsers: dashboardData.dashboardStats.totalUsers,
        totalProperties: dashboardData.dashboardStats.totalProperties,
        pendingReviews: dashboardData.dashboardStats.pendingReviews
      },
      req
    );

    sendSuccessResponse(res, "Admin dashboard retrieved successfully", {
      dashboardStats: dashboardData.dashboardStats,
      growthRevenue: dashboardData.growthRevenue,
      properties: propertiesWithUrls
    });
  } catch (error) {
    next(error);
  }
};


export const getPlatformOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view platform overview");
    }

    const overview = await AdminDashboardService.getPlatformOverview();

    await logActivity(
      user.id,
      'VIEW_PLATFORM_OVERVIEW',
      'PLATFORM',
      'overview',
      {
        totalUsers: overview.users.total,
        totalProperties: overview.properties.total,
        totalInquiries: overview.engagement.totalInquiries
      },
      req
    );

    sendSuccessResponse(res, "Platform overview retrieved successfully", overview);
  } catch (error) {
    next(error);
  }
};