import prisma from "../prisma";
import { Prisma } from "@prisma/client";
import Logger from "../config/logger";
import { userSelect } from "../prisma/selects";

export interface ActivityLogData {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface PaginatedActivityResult {
  activities: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class ActivityService {
  static async logActivity(data: ActivityLogData): Promise<void> {
    try {
      if (!data.userId) {
        Logger.warn('Activity log skipped: userId is required');
        return;
      }

      if (!data.action) {
        Logger.warn('Activity log skipped: action is required');
        return;
      }

      if (!data.entityType || !data.entityId) {
        Logger.warn('Activity log skipped: entityType and entityId are required');
        return;
      }
      let sanitizedDetails = data.details || {};
      
      if (sanitizedDetails.password) {
        delete sanitizedDetails.password;
      }
      if (sanitizedDetails.token) {
        delete sanitizedDetails.token;
      }
      if (sanitizedDetails.accessToken) {
        delete sanitizedDetails.accessToken;
      }
      if (sanitizedDetails.refreshToken) {
        delete sanitizedDetails.refreshToken;
      }

      // Truncate description if too long
      let description = data.description || data.action;
      if (description.length > 500) {
        description = description.substring(0, 497) + '...';
      }

      await prisma.activityLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          description,
          details: sanitizedDetails,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent
        }
      });

      Logger.debug(`Activity logged: ${data.action} on ${data.entityType} by ${data.userId}`);
    } catch (error) {
      Logger.error('Failed to log activity:', error);
    }
  }

  static async logActivityWithRetry(
    data: ActivityLogData,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.logActivity(data);
        return;
      } catch (error) {
        lastError = error as Error;
        Logger.warn(`Activity log attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }
    
    Logger.error(`Activity log failed after ${maxRetries} attempts:`, lastError);
  }


  static async getActivities(filters: ActivityFilters): Promise<PaginatedActivityResult> {
    const {
      entityType,
      action,
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = filters;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: Prisma.ActivityLogWhereInput = {};

    if (entityType) {
      where.entityType = entityType;
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatar: true
            }
          }
        }
      }),
      prisma.activityLog.count({ where })
    ]);

    return {
      activities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    };
  }

  static async getActivityById(activityId: string): Promise<any | null> {
    const activity = await prisma.activityLog.findUnique({
      where: { id: activityId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            avatar: true,
            location: true
          }
        }
      }
    });

    return activity;
  }

  static async getUserActivities(
    userId: string,
    filters: Omit<ActivityFilters, 'userId'>
  ): Promise<PaginatedActivityResult> {
    return this.getActivities({
      ...filters,
      userId
    });
  }

 
  static async getEntityActivities(
    entityType: string,
    entityId: string,
    filters: Omit<ActivityFilters, 'entityType' | 'entityId'>
  ): Promise<PaginatedActivityResult> {
    return this.getActivities({
      ...filters,
      entityType,
      entityId
    });
  }


  static async getActivityStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    const where: Prisma.ActivityLogWhereInput = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [total, byAction, byEntityType, byUser, recentActivities] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10
      }),
      prisma.activityLog.groupBy({
        by: ['entityType'],
        where,
        _count: true,
        orderBy: { _count: { entityType: 'desc' } },
        take: 10
      }),
      prisma.activityLog.groupBy({
        by: ['userId'],
        where,
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatar: true
            }
          }
        }
      })
    ]);

    return {
      total,
      topActions: byAction.map((item:any) => ({
        action: item.action,
        count: item._count
      })),
      topEntityTypes: byEntityType.map((item:any) => ({
        entityType: item.entityType,
        count: item._count
      })),
      topUsers: byUser.map((item:any) => ({
        user: item.user,
        count: item._count
      })),
      recentActivities
    };
  }


  static async deleteOldActivities(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.activityLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    Logger.info(`Deleted ${result.count} activity logs older than ${daysOld} days`);
    return result.count;
  }


  static async bulkLogActivities(activities: ActivityLogData[]): Promise<void> {
    try {
      const validActivities = activities
        .filter(data => data.userId && data.action && data.entityType && data.entityId)
        .map(data => ({
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          description: data.description || data.action,
          details: data.details || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent
        }));

      if (validActivities.length === 0) {
        Logger.warn('No valid activities to bulk log');
        return;
      }

      const chunkSize = 100;
      for (let i = 0; i < validActivities.length; i += chunkSize) {
        const chunk = validActivities.slice(i, i + chunkSize);
        await prisma.activityLog.createMany({
          data: chunk,
          skipDuplicates: true
        });
      }

      Logger.debug(`Bulk logged ${validActivities.length} activities`);
    } catch (error) {
      Logger.error('Failed to bulk log activities:', error);
    }
  }


  static formatActivity(activity: any): any {
    let amount = null;
    let status = null;
    let description = activity.action;
    let details: any = {};

    try {
      if (activity.details) {
        details = typeof activity.details === 'string'
          ? JSON.parse(activity.details)
          : activity.details;

        amount = details?.amount || details?.totalAmount || details?.actualCost || null;
        status = details?.status || details?.paymentStatus || details?.requestStatus || null;

        switch (activity.entityType) {
          case 'PAYMENT':
            description = `${activity.action} of ${amount ? `$${Number(amount).toLocaleString()}` : 'payment'}`;
            if (details?.type) description += ` (${details.type})`;
            if (status) description += ` - ${status}`;
            break;

          case 'PROPERTY':
            description = `${activity.action}: ${details?.propertyName || 'Property'}`;
            if (details?.listingStatus) description += ` - ${details.listingStatus}`;
            if (details?.listingType) description += ` (${details.listingType})`;
            if (details?.rejectionReason) description += ` - Reason: ${details.rejectionReason}`;
            break;

          case 'USER':
            description = `${activity.action}: ${details?.userName || details?.email || 'User'}`;
            if (details?.role) description += ` as ${details.role}`;
            break;

          case 'NIN':
            description = `${activity.action}: NIN verification`;
            if (details?.status) description += ` - ${details.status}`;
            if (details?.rejectionReason) description += ` (${details.rejectionReason})`;
            break;

          case 'STAFF':
            description = `${activity.action}: Staff ${details?.employeeId || ''}`;
            if (details?.department) description += ` - ${details.department}`;
            break;

          case 'VENDOR':
            description = `${activity.action}: Vendor ${details?.vendorName || ''}`;
            if (details?.ninStatus) description += ` - NIN: ${details.ninStatus}`;
            break;

          default:
            description = `${activity.action}: ${details?.title || activity.entityId}`;
        }
      }
    } catch (error) {
      Logger.error('Error formatting activity:', error);
      description = activity.action;
    }

    return {
      id: activity.id,
      description,
      activityType: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      amount: amount ? Number(amount) : null,
      status: status || null,
      timeline: activity.createdAt,
      user: activity.user ? {
        id: activity.user.id,
        fullName: activity.user.fullName,
        email: activity.user.email,
        role: activity.user.role,
        avatar: activity.user.avatar
      } : null,
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent
    };
  }


  static formatActivities(activities: any[]): any[] {
    return activities.map(activity => this.formatActivity(activity));
  }


  static async getUserActivitySummary(userId: string): Promise<any> {
    const [total, byAction, byEntityType, recent] = await Promise.all([
      prisma.activityLog.count({ where: { userId } }),
      prisma.activityLog.groupBy({
        by: ['action'],
        where: { userId },
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 5
      }),
      prisma.activityLog.groupBy({
        by: ['entityType'],
        where: { userId },
        _count: true,
        orderBy: { _count: { entityType: 'desc' } },
        take: 5
      }),
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatar: true
            }
          }
        }
      })
    ]);

    return {
      total,
      topActions: byAction.map((item:any) => ({
        action: item.action,
        count: item._count
      })),
      topEntityTypes: byEntityType.map((item:any) => ({
        entityType: item.entityType,
        count: item._count
      })),
      recentActivities: this.formatActivities(recent)
    };
  }

  static async getVendorActivitySummary(vendorId: string): Promise<any> {
    const [properties, propertyActivities, ninActivities] = await Promise.all([
      prisma.property.count({ where: { vendorId } }),
      prisma.activityLog.count({
        where: {
          userId: vendorId,
          entityType: 'PROPERTY'
        }
      }),
      prisma.activityLog.count({
        where: {
          userId: vendorId,
          entityType: 'NIN'
        }
      })
    ]);

    const recentPropertyActivity = await prisma.activityLog.findMany({
      where: {
        userId: vendorId,
        entityType: 'PROPERTY'
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            avatar: true
          }
        }
      }
    });

    return {
      totalProperties: properties,
      totalPropertyActivities: propertyActivities,
      totalNINActivities: ninActivities,
      recentPropertyActivity: this.formatActivities(recentPropertyActivity)
    };
  }


  static async getAdminActivitySummary(): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now);
    thisWeek.setDate(now.getDate() - now.getDay());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalActivities,
      todayActivities,
      thisWeekActivities,
      thisMonthActivities,
      pendingVerifications,
      pendingProperties,
      byAction
    ] = await Promise.all([
      prisma.activityLog.count(),
      prisma.activityLog.count({ where: { createdAt: { gte: today } } }),
      prisma.activityLog.count({ where: { createdAt: { gte: thisWeek } } }),
      prisma.activityLog.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.user.count({
        where: {
          role: 'VENDOR',
          ninVerificationStatus: 'PENDING'
        }
      }),
      prisma.property.count({
        where: {
          listingStatus: 'PENDING'
        }
      }),
      prisma.activityLog.groupBy({
        by: ['action'],
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 5
      })
    ]);

    return {
      totalActivities,
      todayActivities,
      thisWeekActivities,
      thisMonthActivities,
      pendingVerifications,
      pendingProperties,
      topActions: byAction.map((item:any) => ({
        action: item.action,
        count: item._count
      }))
    };
  }
}