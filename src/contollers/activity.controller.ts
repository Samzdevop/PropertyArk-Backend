import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { ActivityService, ActivityFilters } from "../services/activity.service";
import { Role } from "@prisma/client";
import prisma from "../prisma";


export const logActivity = async (
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: any = {},
  req?: Request
): Promise<void> => {
  await ActivityService.logActivity({
    userId,
    action,
    entityType,
    entityId,
    description: details?.description || action,
    details,
    ipAddress: req?.ip,
    userAgent: req?.get('user-agent')
  });
};

// Get all activities with optional filters (Admin only)
export const getAllActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only administrators can view all activities");
    }

    const {
      entityType,
      action,
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const filters: ActivityFilters = {
      entityType: entityType as string,
      action: action as string,
      userId: userId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: Number(page),
      limit: Number(limit)
    };

    const result = await ActivityService.getActivities(filters);
    const formattedActivities = ActivityService.formatActivities(result.activities);

    sendSuccessResponse(res, "Activities retrieved successfully", {
      activities: formattedActivities,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

// Get activity by ID (Admin only)
export const getActivityById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;    
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only administrators can view activity details");
    }

    const activity = await ActivityService.getActivityById(id as string);

    if (!activity) {
      throw new NotFoundError("Activity not found");
    }

    const formattedActivity = ActivityService.formatActivity(activity);

    sendSuccessResponse(res, "Activity retrieved successfully", formattedActivity);
  } catch (error) {
    next(error);
  }
};


// Get activities for a specific user (Admin or the user themselves)
export const getUserActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUser = req.user as any;
    const {
      entityType,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    // Check permissions
    if (currentUser.role !== Role.ADMIN && currentUser.id !== userId) {
      if (currentUser.role === Role.VENDOR) {
        throw new ForbiddenError("Vendors can only view their own activities");
      }

      if (currentUser.role === Role.STAFF) {
        throw new ForbiddenError("Staff can only view their own activities");
      }
      
      if (currentUser.role === Role.USER) {
        throw new ForbiddenError("Users can only view their own activities");
      }
      
      throw new ForbiddenError("You can only view your own activities");
    }

    if (currentUser.role === Role.ADMIN && currentUser.id !== userId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId as string },
        select: { id: true, role: true }
      });
      
      if (!targetUser) {
        throw new NotFoundError("User not found");
      }
    }

    const filters: ActivityFilters = {
      userId: userId as string,
      entityType: entityType as string,
      action: action as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: Number(page),
      limit: Number(limit)
    };

    const result = await ActivityService.getUserActivities(userId as string, filters);
    const formattedActivities = ActivityService.formatActivities(result.activities);


    const targetUser = await prisma.user.findUnique({
      where: { id: userId as string },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        avatar: true
      }
    });

    sendSuccessResponse(res, "User activities retrieved successfully", {
      user: targetUser,
      activities: formattedActivities,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get activities for a specific entity
 * Only accessible by ADMIN
 */
export const getEntityActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { entityType, entityId } = req.params;
    const user = req.user as any;
    const {
      page = 1,
      limit = 20
    } = req.query;

    // Only admins can view activities by entity
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only administrators can view entity activities");
    }

    // Validate entity type
    const validEntityTypes = [
      'PROPERTY', 'USER', 'DOCUMENT', 
      'NIN', 'PROPERTY_REVIEW', 'PAYMENT', 'NOTIFICATION'
    ];
    
    if (!validEntityTypes.includes(entityType as string)) {
      throw new NotFoundError("Invalid entity type");
    }

    const filters: ActivityFilters = {
      page: Number(page),
      limit: Number(limit)
    };

    const result = await ActivityService.getEntityActivities(
      entityType as string,
      entityId as string,
      filters
    );

    const formattedActivities = ActivityService.formatActivities(result.activities);

    // Fetch entity details based on type
    let entityDetails = null;
    switch (entityType) {
      case 'PROPERTY':
        entityDetails = await prisma.property.findUnique({
          where: { id: entityId as string },
          select: { 
            id: true, 
            name: true, 
            address: true, 
            listingType: true, 
            listingStatus: true,
            vendor: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            },
            staff: {
              select: {
                id: true,
                fullName: true,
                email: true,
                employeeId: true,
                department: true
              }
            }
          }
        });
        break;
      case 'USER':
        entityDetails = await prisma.user.findUnique({
          where: { id: entityId as string },
          select: { 
            id: true, 
            fullName: true, 
            email: true, 
            role: true,
            ninVerificationStatus: true,
            employeeId: true,
            department: true
          }
        });
        break;
      case 'NIN':
        entityDetails = await prisma.document.findFirst({
          where: { 
            vendorId: entityId as string,
            type: 'NIN'
          },
          select: {
            id: true,
            name: true,
            url: true,
            createdAt: true,
            vendor: {
              select: {
                id: true,
                fullName: true,
                email: true,
                ninVerificationStatus: true,
                ninRejectionReason: true
              }
            }
          }
        });
        break;
    }

    sendSuccessResponse(res, "Entity activities retrieved successfully", {
      entity: entityDetails,
      activities: formattedActivities,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get activity statistics
 * Only accessible by ADMIN
 */
export const getActivityStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    // Only admins can view activity statistics
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only administrators can view activity statistics");
    }

    const { startDate, endDate } = req.query;

    const stats = await ActivityService.getActivityStats(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    sendSuccessResponse(res, "Activity statistics retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's activity summary
 * Any authenticated user can view their own summary
 */
export const getMyActivitySummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    // Role-based summary
    let summary;
    if (user.role === Role.ADMIN) {
      summary = await ActivityService.getAdminActivitySummary();
    } else if (user.role === Role.VENDOR) {
      summary = await ActivityService.getVendorActivitySummary(user.id);
    } else {
      summary = await ActivityService.getUserActivitySummary(user.id);
    }

    sendSuccessResponse(res, "Your activity summary retrieved successfully", {
      ...summary,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get vendor activity summary (for vendor dashboard)
 * Only accessible by VENDOR or ADMIN
 */
export const getVendorActivitySummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { vendorId } = req.params;
    const currentUser = req.user as any;

    // Check permissions
    if (currentUser.role !== Role.ADMIN && currentUser.id !== vendorId) {
      throw new ForbiddenError("You can only view your own vendor summary");
    }

    // Verify vendor exists
    const vendor = await prisma.user.findUnique({
      where: { id: vendorId as string, role: Role.VENDOR }
    });

    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }

    const summary = await ActivityService.getVendorActivitySummary(vendorId as string);

    sendSuccessResponse(res, "Vendor activity summary retrieved successfully", {
      vendor: {
        id: vendor.id,
        fullName: vendor.fullName,
        email: vendor.email,
        ninVerificationStatus: vendor.ninVerificationStatus
      },
      ...summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin dashboard summary
 * Only accessible by ADMIN
 */
export const getAdminDashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only administrators can view admin dashboard");
    }

    const summary = await ActivityService.getAdminActivitySummary();

    // Get additional admin stats
    const [totalVendors, totalUsers, totalStaff, totalProperties] = await Promise.all([
      prisma.user.count({ where: { role: Role.VENDOR } }),
      prisma.user.count({ where: { role: Role.USER } }),
      prisma.user.count({ where: { role: Role.STAFF } }),
      prisma.property.count()
    ]);

    sendSuccessResponse(res, "Admin dashboard summary retrieved successfully", {
      ...summary,
      totalVendors,
      totalUsers,
      totalStaff,
      totalProperties
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cleanup old activities (Admin only)
 */
export const cleanupActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only administrators can cleanup activities");
    }

    const { days = 90 } = req.query;

    const deletedCount = await ActivityService.deleteOldActivities(Number(days));

    await logActivity(
      user.id,
      'CLEANUP_ACTIVITIES',
      'ACTIVITY',
      'system',
      { deletedCount, daysOld: Number(days) },
      req
    );

    sendSuccessResponse(res, `Cleaned up ${deletedCount} old activities`, {
      deletedCount,
      daysOld: Number(days)
    });
  } catch (error) {
    next(error);
  }
};