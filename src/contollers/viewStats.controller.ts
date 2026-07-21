import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { ViewTrackingService } from "../services/viewTracking.service";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role } from "@prisma/client";
import { logActivity } from "./activity.controller";
import { NotFoundError } from "../errors/NotFoundError";
import prisma from "../prisma";


export const getVendorViewStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can view statistics");
    }

    const stats = await ViewTrackingService.getVendorViewStats(user.id);

    await logActivity(
      user.id,
      'VIEW_VENDOR_VIEW_STATS',
      'DASHBOARD',
      'vendor',
      { totalViews: stats.summary.totalViews },
      req
    );

    sendSuccessResponse(res, "Vendor view statistics retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};


export const getPropertyViewStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { propertyId } = req.params;
    const user = req.user as any;

    // Check if user owns this property or is admin
    const property = await prisma.property.findUnique({
      where: { id: propertyId as string },
      select: {  id: true, vendorId: true, name: true, viewCount: true, inquiryCount: true }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (user.role !== Role.ADMIN && property.vendorId !== user.id) {
      throw new ForbiddenError("You don't have access to this property's statistics");
    }

    // Get view history for this property (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyViews = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE("viewedAt") as date,
        COUNT(*) as count
      FROM "PropertyView"
      WHERE "propertyId" = ${propertyId}
        AND "viewedAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("viewedAt")
      ORDER BY date DESC
    `;

    const stats = {
      propertyId: property.id as string,
      propertyName: property.name,
      totalViews: property.viewCount,
      totalInquiries: property.inquiryCount,
      dailyViews: dailyViews.map((item:any) => ({
        date: item.date,
        count: item.count
      }))
    };

    await logActivity(
      user.id,
      'VIEW_PROPERTY_STATS',
      'PROPERTY',
      propertyId as string,
      { totalViews: property.viewCount },
      req
    );

    sendSuccessResponse(res, "Property view statistics retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard view summary (for vendor dashboard)
 * Access: VENDOR, ADMIN
 */
export const getDashboardViewSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can view dashboard");
    }

    const stats = await ViewTrackingService.getVendorViewStats(user.id);

    // Return a simplified version for the dashboard
    const summary = {
      totalViews: stats.summary.totalViews,
      totalInquiries: stats.summary.totalInquiries,
      todayViews: stats.summary.todayViews,
      weeklyViews: stats.summary.weeklyViews,
      topProperties: stats.topProperties,
      weeklyPerformance: stats.weeklyPerformance
    };

    sendSuccessResponse(res, "Dashboard view summary retrieved successfully", summary);
  } catch (error) {
    next(error);
  }
};