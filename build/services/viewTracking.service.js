"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewTrackingService = void 0;
// services/viewTracking.service.ts
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../config/logger"));
class ViewTrackingService {
    static async trackView(propertyId, userId) {
        try {
            const property = await prisma_1.default.property.findUnique({
                where: {
                    id: propertyId,
                    listingStatus: client_1.PropertyListingStatus.ACTIVE
                },
                select: { id: true, name: true, vendorId: true }
            });
            if (!property) {
                logger_1.default.warn(`Attempted to track view for non-existent property: ${propertyId}`);
                return;
            }
            await prisma_1.default.propertyView.create({
                data: {
                    propertyId,
                    viewerId: userId || null,
                    viewedAt: new Date()
                }
            });
            await prisma_1.default.property.update({
                where: { id: propertyId },
                data: { viewCount: { increment: 1 } }
            });
            logger_1.default.debug(`View tracked for property ${propertyId} by ${userId || 'anonymous'}`);
        }
        catch (error) {
            logger_1.default.error('Failed to track property view:', error);
        }
    }
    static async trackMultipleViews(propertyIds, userId) {
        try {
            for (const propertyId of propertyIds) {
                await this.trackView(propertyId, userId);
            }
        }
        catch (error) {
            logger_1.default.error('Failed to track multiple property views:', error);
        }
    }
    static async getVendorViewStats(vendorId) {
        const properties = await prisma_1.default.property.findMany({
            where: { vendorId },
            select: {
                id: true,
                name: true,
                viewCount: true,
                inquiryCount: true,
                listingStatus: true,
                createdAt: true
            },
            orderBy: { viewCount: 'desc' }
        });
        if (properties.length === 0) {
            return {
                totalViews: 0,
                totalInquiries: 0,
                propertiesCount: 0,
                weeklyPerformance: [],
                topProperties: []
            };
        }
        const propertyIds = properties.map(p => p.id);
        const totalViews = properties.reduce((sum, p) => sum + p.viewCount, 0);
        const totalInquiries = properties.reduce((sum, p) => sum + p.inquiryCount, 0);
        const weeklyPerformance = await this.getWeeklyPerformance(propertyIds);
        const topProperties = properties.slice(0, 5).map(p => ({
            id: p.id,
            name: p.name,
            views: p.viewCount,
            inquiries: p.inquiryCount,
            status: p.listingStatus
        }));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayViews = await prisma_1.default.propertyView.count({
            where: {
                propertyId: { in: propertyIds },
                viewedAt: { gte: today }
            }
        });
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weeklyViews = await prisma_1.default.propertyView.count({
            where: {
                propertyId: { in: propertyIds },
                viewedAt: { gte: weekAgo }
            }
        });
        return {
            summary: {
                totalViews,
                totalInquiries,
                todayViews,
                weeklyViews,
                propertiesCount: properties.length
            },
            weeklyPerformance,
            topProperties
        };
    }
    /**
     * INDUSTRY STANDARD: Using Prisma.join() with proper typing
     * This is the recommended approach for Prisma v5+
     */
    static async getWeeklyPerformance(propertyIds) {
        const weeks = 12;
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (weeks * 7));
        // ✅ Industry Standard: Using Prisma.join() with type safety
        const weeklyViews = await prisma_1.default.$queryRaw `
      SELECT 
        DATE_TRUNC('week', "viewedAt") as week_start,
        COUNT(*) as view_count
      FROM "PropertyView"
      WHERE "propertyId" IN (${client_1.Prisma.join(propertyIds)})
        AND "viewedAt" >= ${startDate}
      GROUP BY DATE_TRUNC('week', "viewedAt")
      ORDER BY week_start ASC
    `;
        const weeklyInquiries = await prisma_1.default.$queryRaw `
      SELECT 
        DATE_TRUNC('week', "createdAt") as week_start,
        COUNT(*) as inquiry_count
      FROM "Inquiry"
      WHERE "propertyId" IN (${client_1.Prisma.join(propertyIds)})
        AND "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY week_start ASC
    `;
        // Generate weekly data
        const result = [];
        for (let i = 0; i < weeks; i++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() + (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const viewData = weeklyViews.find((item) => {
                const itemDate = new Date(item.week_start);
                return itemDate >= weekStart && itemDate <= weekEnd;
            });
            const inquiryData = weeklyInquiries.find((item) => {
                const itemDate = new Date(item.week_start);
                return itemDate >= weekStart && itemDate <= weekEnd;
            });
            result.push({
                date: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                month: weekStart.toLocaleDateString('en-US', { month: 'short' }),
                year: weekStart.getFullYear(),
                totalViews: viewData?.view_count || 0,
                totalInquiries: inquiryData?.inquiry_count || 0
            });
        }
        return result;
    }
}
exports.ViewTrackingService = ViewTrackingService;
