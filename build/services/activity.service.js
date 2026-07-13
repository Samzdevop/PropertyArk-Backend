"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const logger_1 = __importDefault(require("../config/logger"));
class ActivityService {
    static async logActivity(data) {
        try {
            if (!data.userId) {
                logger_1.default.warn('Activity log skipped: userId is required');
                return;
            }
            if (!data.action) {
                logger_1.default.warn('Activity log skipped: action is required');
                return;
            }
            if (!data.entityType || !data.entityId) {
                logger_1.default.warn('Activity log skipped: entityType and entityId are required');
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
            await prisma_1.default.activityLog.create({
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
            logger_1.default.debug(`Activity logged: ${data.action} on ${data.entityType} by ${data.userId}`);
        }
        catch (error) {
            logger_1.default.error('Failed to log activity:', error);
        }
    }
    static async logActivityWithRetry(data, maxRetries = 3, delayMs = 1000) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.logActivity(data);
                return;
            }
            catch (error) {
                lastError = error;
                logger_1.default.warn(`Activity log attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                }
            }
        }
        logger_1.default.error(`Activity log failed after ${maxRetries} attempts:`, lastError);
    }
    static async getActivities(filters) {
        const { entityType, action, userId, startDate, endDate, page = 1, limit = 20 } = filters;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {};
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
            prisma_1.default.activityLog.findMany({
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
            prisma_1.default.activityLog.count({ where })
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
    static async getActivityById(activityId) {
        const activity = await prisma_1.default.activityLog.findUnique({
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
    static async getUserActivities(userId, filters) {
        return this.getActivities({
            ...filters,
            userId
        });
    }
    static async getEntityActivities(entityType, entityId, filters) {
        return this.getActivities({
            ...filters,
            entityType,
            entityId
        });
    }
    static async getActivityStats(startDate, endDate) {
        const where = {};
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
            prisma_1.default.activityLog.count({ where }),
            prisma_1.default.activityLog.groupBy({
                by: ['action'],
                where,
                _count: true,
                orderBy: { _count: { action: 'desc' } },
                take: 10
            }),
            prisma_1.default.activityLog.groupBy({
                by: ['entityType'],
                where,
                _count: true,
                orderBy: { _count: { entityType: 'desc' } },
                take: 10
            }),
            prisma_1.default.activityLog.groupBy({
                by: ['userId'],
                where,
                _count: true,
                orderBy: { _count: { userId: 'desc' } },
                take: 10,
            }),
            prisma_1.default.activityLog.findMany({
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
            topActions: byAction.map((item) => ({
                action: item.action,
                count: item._count
            })),
            topEntityTypes: byEntityType.map((item) => ({
                entityType: item.entityType,
                count: item._count
            })),
            topUsers: byUser.map((item) => ({
                user: item.user,
                count: item._count
            })),
            recentActivities
        };
    }
    static async deleteOldActivities(daysOld = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await prisma_1.default.activityLog.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate
                }
            }
        });
        logger_1.default.info(`Deleted ${result.count} activity logs older than ${daysOld} days`);
        return result.count;
    }
    static async bulkLogActivities(activities) {
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
                logger_1.default.warn('No valid activities to bulk log');
                return;
            }
            const chunkSize = 100;
            for (let i = 0; i < validActivities.length; i += chunkSize) {
                const chunk = validActivities.slice(i, i + chunkSize);
                await prisma_1.default.activityLog.createMany({
                    data: chunk,
                    skipDuplicates: true
                });
            }
            logger_1.default.debug(`Bulk logged ${validActivities.length} activities`);
        }
        catch (error) {
            logger_1.default.error('Failed to bulk log activities:', error);
        }
    }
    static formatActivity(activity) {
        let amount = null;
        let status = null;
        let description = activity.action;
        let details = {};
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
                        if (details?.type)
                            description += ` (${details.type})`;
                        if (status)
                            description += ` - ${status}`;
                        break;
                    case 'PROPERTY':
                        description = `${activity.action}: ${details?.propertyName || 'Property'}`;
                        if (details?.listingStatus)
                            description += ` - ${details.listingStatus}`;
                        if (details?.listingType)
                            description += ` (${details.listingType})`;
                        if (details?.rejectionReason)
                            description += ` - Reason: ${details.rejectionReason}`;
                        break;
                    case 'USER':
                        description = `${activity.action}: ${details?.userName || details?.email || 'User'}`;
                        if (details?.role)
                            description += ` as ${details.role}`;
                        break;
                    case 'NIN':
                        description = `${activity.action}: NIN verification`;
                        if (details?.status)
                            description += ` - ${details.status}`;
                        if (details?.rejectionReason)
                            description += ` (${details.rejectionReason})`;
                        break;
                    case 'STAFF':
                        description = `${activity.action}: Staff ${details?.employeeId || ''}`;
                        if (details?.department)
                            description += ` - ${details.department}`;
                        break;
                    case 'VENDOR':
                        description = `${activity.action}: Vendor ${details?.vendorName || ''}`;
                        if (details?.ninStatus)
                            description += ` - NIN: ${details.ninStatus}`;
                        break;
                    default:
                        description = `${activity.action}: ${details?.title || activity.entityId}`;
                }
            }
        }
        catch (error) {
            logger_1.default.error('Error formatting activity:', error);
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
    static formatActivities(activities) {
        return activities.map(activity => this.formatActivity(activity));
    }
    static async getUserActivitySummary(userId) {
        const [total, byAction, byEntityType, recent] = await Promise.all([
            prisma_1.default.activityLog.count({ where: { userId } }),
            prisma_1.default.activityLog.groupBy({
                by: ['action'],
                where: { userId },
                _count: true,
                orderBy: { _count: { action: 'desc' } },
                take: 5
            }),
            prisma_1.default.activityLog.groupBy({
                by: ['entityType'],
                where: { userId },
                _count: true,
                orderBy: { _count: { entityType: 'desc' } },
                take: 5
            }),
            prisma_1.default.activityLog.findMany({
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
            topActions: byAction.map((item) => ({
                action: item.action,
                count: item._count
            })),
            topEntityTypes: byEntityType.map((item) => ({
                entityType: item.entityType,
                count: item._count
            })),
            recentActivities: this.formatActivities(recent)
        };
    }
    static async getVendorActivitySummary(vendorId) {
        const [properties, propertyActivities, ninActivities] = await Promise.all([
            prisma_1.default.property.count({ where: { vendorId } }),
            prisma_1.default.activityLog.count({
                where: {
                    userId: vendorId,
                    entityType: 'PROPERTY'
                }
            }),
            prisma_1.default.activityLog.count({
                where: {
                    userId: vendorId,
                    entityType: 'NIN'
                }
            })
        ]);
        const recentPropertyActivity = await prisma_1.default.activityLog.findMany({
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
    static async getAdminActivitySummary() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(now);
        thisWeek.setDate(now.getDate() - now.getDay());
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const [totalActivities, todayActivities, thisWeekActivities, thisMonthActivities, pendingVerifications, pendingProperties, byAction] = await Promise.all([
            prisma_1.default.activityLog.count(),
            prisma_1.default.activityLog.count({ where: { createdAt: { gte: today } } }),
            prisma_1.default.activityLog.count({ where: { createdAt: { gte: thisWeek } } }),
            prisma_1.default.activityLog.count({ where: { createdAt: { gte: thisMonth } } }),
            prisma_1.default.user.count({
                where: {
                    role: 'VENDOR',
                    ninVerificationStatus: 'PENDING'
                }
            }),
            prisma_1.default.property.count({
                where: {
                    listingStatus: 'PENDING'
                }
            }),
            prisma_1.default.activityLog.groupBy({
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
            topActions: byAction.map((item) => ({
                action: item.action,
                count: item._count
            }))
        };
    }
}
exports.ActivityService = ActivityService;
