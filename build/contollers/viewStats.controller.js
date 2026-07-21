"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardViewSummary = exports.getPropertyViewStats = exports.getVendorViewStats = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const viewTracking_service_1 = require("../services/viewTracking.service");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const activity_controller_1 = require("./activity.controller");
const NotFoundError_1 = require("../errors/NotFoundError");
const prisma_1 = __importDefault(require("../prisma"));
const getVendorViewStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can view statistics");
        }
        const stats = await viewTracking_service_1.ViewTrackingService.getVendorViewStats(user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_VENDOR_VIEW_STATS', 'DASHBOARD', 'vendor', { totalViews: stats.summary.totalViews }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Vendor view statistics retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorViewStats = getVendorViewStats;
const getPropertyViewStats = async (req, res, next) => {
    try {
        const { propertyId } = req.params;
        const user = req.user;
        // Check if user owns this property or is admin
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            select: { id: true, vendorId: true, name: true, viewCount: true, inquiryCount: true }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        if (user.role !== client_1.Role.ADMIN && property.vendorId !== user.id) {
            throw new ForbiddenError_1.ForbiddenError("You don't have access to this property's statistics");
        }
        // Get view history for this property (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dailyViews = await prisma_1.default.$queryRaw `
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
            propertyId: property.id,
            propertyName: property.name,
            totalViews: property.viewCount,
            totalInquiries: property.inquiryCount,
            dailyViews: dailyViews.map((item) => ({
                date: item.date,
                count: item.count
            }))
        };
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_PROPERTY_STATS', 'PROPERTY', propertyId, { totalViews: property.viewCount }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property view statistics retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getPropertyViewStats = getPropertyViewStats;
/**
 * Get dashboard view summary (for vendor dashboard)
 * Access: VENDOR, ADMIN
 */
const getDashboardViewSummary = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can view dashboard");
        }
        const stats = await viewTracking_service_1.ViewTrackingService.getVendorViewStats(user.id);
        // Return a simplified version for the dashboard
        const summary = {
            totalViews: stats.summary.totalViews,
            totalInquiries: stats.summary.totalInquiries,
            todayViews: stats.summary.todayViews,
            weeklyViews: stats.summary.weeklyViews,
            topProperties: stats.topProperties,
            weeklyPerformance: stats.weeklyPerformance
        };
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Dashboard view summary retrieved successfully", summary);
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboardViewSummary = getDashboardViewSummary;
