"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformOverview = exports.getAdminDashboardOverview = exports.getPropertyManagementStats = exports.getNINStats = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const adminDashboard_service_1 = require("../services/adminDashboard.service");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const attachBaseUrl_utils_1 = require("../utils/attachBaseUrl.utils");
const serialize_utils_1 = require("../utils/serialize.utils");
const getNINStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view NIN statistics");
        }
        const stats = await adminDashboard_service_1.AdminDashboardService.getNINStats();
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_NIN_STATS', 'NIN', 'stats', {
            pending: stats.stats.pending,
            verified: stats.stats.verified,
            rejected: stats.stats.rejected
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "NIN statistics retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getNINStats = getNINStats;
const getPropertyManagementStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view property management statistics");
        }
        const { page = 1, limit = 20, status, listingType, search } = req.query;
        const result = await adminDashboard_service_1.AdminDashboardService.getPropertyManagementStats(Number(page), Number(limit), {
            status: status,
            listingType: listingType,
            search: search
        });
        // Attach base URLs to media
        const propertiesWithUrls = (0, attachBaseUrl_utils_1.attachBaseUrlUploads)((0, serialize_utils_1.serializeDates)(result.properties), req);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_PROPERTY_MANAGEMENT_STATS', 'PROPERTY', 'stats', {
            totalListings: result.stats.totalListings,
            pendingReviews: result.stats.pendingReviews,
            activeListings: result.stats.activeListings
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property management statistics retrieved successfully", {
            stats: result.stats,
            properties: propertiesWithUrls,
            pagination: result.pagination
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPropertyManagementStats = getPropertyManagementStats;
const getAdminDashboardOverview = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view the dashboard");
        }
        const dashboardData = await adminDashboard_service_1.AdminDashboardService.getAdminDashboardOverview();
        const propertiesWithUrls = (0, attachBaseUrl_utils_1.attachBaseUrlUploads)((0, serialize_utils_1.serializeDates)(dashboardData.properties), req);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_ADMIN_DASHBOARD', 'DASHBOARD', 'admin', {
            totalUsers: dashboardData.dashboardStats.totalUsers,
            totalProperties: dashboardData.dashboardStats.totalProperties,
            pendingReviews: dashboardData.dashboardStats.pendingReviews
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Admin dashboard retrieved successfully", {
            dashboardStats: dashboardData.dashboardStats,
            growthRevenue: dashboardData.growthRevenue,
            properties: propertiesWithUrls
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAdminDashboardOverview = getAdminDashboardOverview;
const getPlatformOverview = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view platform overview");
        }
        const overview = await adminDashboard_service_1.AdminDashboardService.getPlatformOverview();
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_PLATFORM_OVERVIEW', 'PLATFORM', 'overview', {
            totalUsers: overview.users.total,
            totalProperties: overview.properties.total,
            totalInquiries: overview.engagement.totalInquiries
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Platform overview retrieved successfully", overview);
    }
    catch (error) {
        next(error);
    }
};
exports.getPlatformOverview = getPlatformOverview;
