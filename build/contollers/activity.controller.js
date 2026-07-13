"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupActivities = exports.getAdminDashboardSummary = exports.getVendorActivitySummary = exports.getMyActivitySummary = exports.getActivityStats = exports.getEntityActivities = exports.getUserActivities = exports.getActivityById = exports.getAllActivities = exports.logActivity = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const activity_service_1 = require("../services/activity.service");
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../prisma"));
const logActivity = async (userId, action, entityType, entityId, details = {}, req) => {
    await activity_service_1.ActivityService.logActivity({
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
exports.logActivity = logActivity;
// Get all activities with optional filters (Admin only)
const getAllActivities = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only administrators can view all activities");
        }
        const { entityType, action, userId, startDate, endDate, page = 1, limit = 20 } = req.query;
        const filters = {
            entityType: entityType,
            action: action,
            userId: userId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            page: Number(page),
            limit: Number(limit)
        };
        const result = await activity_service_1.ActivityService.getActivities(filters);
        const formattedActivities = activity_service_1.ActivityService.formatActivities(result.activities);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Activities retrieved successfully", {
            activities: formattedActivities,
            pagination: result.pagination
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllActivities = getAllActivities;
// Get activity by ID (Admin only)
const getActivityById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only administrators can view activity details");
        }
        const activity = await activity_service_1.ActivityService.getActivityById(id);
        if (!activity) {
            throw new NotFoundError_1.NotFoundError("Activity not found");
        }
        const formattedActivity = activity_service_1.ActivityService.formatActivity(activity);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Activity retrieved successfully", formattedActivity);
    }
    catch (error) {
        next(error);
    }
};
exports.getActivityById = getActivityById;
// Get activities for a specific user (Admin or the user themselves)
const getUserActivities = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const currentUser = req.user;
        const { entityType, action, startDate, endDate, page = 1, limit = 20 } = req.query;
        // Check permissions
        if (currentUser.role !== client_1.Role.ADMIN && currentUser.id !== userId) {
            if (currentUser.role === client_1.Role.VENDOR) {
                throw new ForbiddenError_1.ForbiddenError("Vendors can only view their own activities");
            }
            if (currentUser.role === client_1.Role.STAFF) {
                throw new ForbiddenError_1.ForbiddenError("Staff can only view their own activities");
            }
            if (currentUser.role === client_1.Role.USER) {
                throw new ForbiddenError_1.ForbiddenError("Users can only view their own activities");
            }
            throw new ForbiddenError_1.ForbiddenError("You can only view your own activities");
        }
        if (currentUser.role === client_1.Role.ADMIN && currentUser.id !== userId) {
            const targetUser = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true }
            });
            if (!targetUser) {
                throw new NotFoundError_1.NotFoundError("User not found");
            }
        }
        const filters = {
            userId: userId,
            entityType: entityType,
            action: action,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            page: Number(page),
            limit: Number(limit)
        };
        const result = await activity_service_1.ActivityService.getUserActivities(userId, filters);
        const formattedActivities = activity_service_1.ActivityService.formatActivities(result.activities);
        const targetUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                avatar: true
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "User activities retrieved successfully", {
            user: targetUser,
            activities: formattedActivities,
            pagination: result.pagination
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserActivities = getUserActivities;
/**
 * Get activities for a specific entity
 * Only accessible by ADMIN
 */
const getEntityActivities = async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;
        const user = req.user;
        const { page = 1, limit = 20 } = req.query;
        // Only admins can view activities by entity
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only administrators can view entity activities");
        }
        // Validate entity type
        const validEntityTypes = [
            'PROPERTY', 'USER', 'DOCUMENT',
            'NIN', 'PROPERTY_REVIEW', 'PAYMENT', 'NOTIFICATION'
        ];
        if (!validEntityTypes.includes(entityType)) {
            throw new NotFoundError_1.NotFoundError("Invalid entity type");
        }
        const filters = {
            page: Number(page),
            limit: Number(limit)
        };
        const result = await activity_service_1.ActivityService.getEntityActivities(entityType, entityId, filters);
        const formattedActivities = activity_service_1.ActivityService.formatActivities(result.activities);
        // Fetch entity details based on type
        let entityDetails = null;
        switch (entityType) {
            case 'PROPERTY':
                entityDetails = await prisma_1.default.property.findUnique({
                    where: { id: entityId },
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
                entityDetails = await prisma_1.default.user.findUnique({
                    where: { id: entityId },
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
                entityDetails = await prisma_1.default.document.findFirst({
                    where: {
                        vendorId: entityId,
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
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Entity activities retrieved successfully", {
            entity: entityDetails,
            activities: formattedActivities,
            pagination: result.pagination
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getEntityActivities = getEntityActivities;
/**
 * Get activity statistics
 * Only accessible by ADMIN
 */
const getActivityStats = async (req, res, next) => {
    try {
        const user = req.user;
        // Only admins can view activity statistics
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only administrators can view activity statistics");
        }
        const { startDate, endDate } = req.query;
        const stats = await activity_service_1.ActivityService.getActivityStats(startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Activity statistics retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getActivityStats = getActivityStats;
/**
 * Get current user's activity summary
 * Any authenticated user can view their own summary
 */
const getMyActivitySummary = async (req, res, next) => {
    try {
        const user = req.user;
        // Role-based summary
        let summary;
        if (user.role === client_1.Role.ADMIN) {
            summary = await activity_service_1.ActivityService.getAdminActivitySummary();
        }
        else if (user.role === client_1.Role.VENDOR) {
            summary = await activity_service_1.ActivityService.getVendorActivitySummary(user.id);
        }
        else {
            summary = await activity_service_1.ActivityService.getUserActivitySummary(user.id);
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Your activity summary retrieved successfully", {
            ...summary,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyActivitySummary = getMyActivitySummary;
/**
 * Get vendor activity summary (for vendor dashboard)
 * Only accessible by VENDOR or ADMIN
 */
const getVendorActivitySummary = async (req, res, next) => {
    try {
        const { vendorId } = req.params;
        const currentUser = req.user;
        // Check permissions
        if (currentUser.role !== client_1.Role.ADMIN && currentUser.id !== vendorId) {
            throw new ForbiddenError_1.ForbiddenError("You can only view your own vendor summary");
        }
        // Verify vendor exists
        const vendor = await prisma_1.default.user.findUnique({
            where: { id: vendorId, role: client_1.Role.VENDOR }
        });
        if (!vendor) {
            throw new NotFoundError_1.NotFoundError("Vendor not found");
        }
        const summary = await activity_service_1.ActivityService.getVendorActivitySummary(vendorId);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Vendor activity summary retrieved successfully", {
            vendor: {
                id: vendor.id,
                fullName: vendor.fullName,
                email: vendor.email,
                ninVerificationStatus: vendor.ninVerificationStatus
            },
            ...summary
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorActivitySummary = getVendorActivitySummary;
/**
 * Get admin dashboard summary
 * Only accessible by ADMIN
 */
const getAdminDashboardSummary = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only administrators can view admin dashboard");
        }
        const summary = await activity_service_1.ActivityService.getAdminActivitySummary();
        // Get additional admin stats
        const [totalVendors, totalUsers, totalStaff, totalProperties] = await Promise.all([
            prisma_1.default.user.count({ where: { role: client_1.Role.VENDOR } }),
            prisma_1.default.user.count({ where: { role: client_1.Role.USER } }),
            prisma_1.default.user.count({ where: { role: client_1.Role.STAFF } }),
            prisma_1.default.property.count()
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Admin dashboard summary retrieved successfully", {
            ...summary,
            totalVendors,
            totalUsers,
            totalStaff,
            totalProperties
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAdminDashboardSummary = getAdminDashboardSummary;
/**
 * Cleanup old activities (Admin only)
 */
const cleanupActivities = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only administrators can cleanup activities");
        }
        const { days = 90 } = req.query;
        const deletedCount = await activity_service_1.ActivityService.deleteOldActivities(Number(days));
        await (0, exports.logActivity)(user.id, 'CLEANUP_ACTIVITIES', 'ACTIVITY', 'system', { deletedCount, daysOld: Number(days) }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `Cleaned up ${deletedCount} old activities`, {
            deletedCount,
            daysOld: Number(days)
        });
    }
    catch (error) {
        next(error);
    }
};
exports.cleanupActivities = cleanupActivities;
