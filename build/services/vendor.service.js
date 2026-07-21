"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorService = void 0;
// services/vendor.service.ts
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const date_utils_1 = require("../utils/date.utils");
class VendorService {
    /**
     * Get vendor dashboard statistics
     */
    static async getDashboardStats(vendorId) {
        // Verify vendor exists
        const vendor = await prisma_1.default.user.findUnique({
            where: { id: vendorId, role: client_1.Role.VENDOR }
        });
        if (!vendor) {
            throw new Error("Vendor not found");
        }
        // Get all properties for this vendor
        const properties = await prisma_1.default.property.findMany({
            where: { vendorId },
            select: {
                id: true,
                name: true,
                status: true,
                listingStatus: true,
                listingType: true,
                viewCount: true,
                inquiryCount: true,
                createdAt: true,
                updatedAt: true,
                media: {
                    take: 1,
                    where: { isPrimary: true },
                    select: { url: true }
                },
                _count: {
                    select: {
                        inquiries: true,
                        favorites: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        // Calculate total properties stats
        const totalProperties = properties.length;
        const activeListings = properties.filter(p => p.listingStatus === client_1.PropertyListingStatus.ACTIVE).length;
        const pendingApproval = properties.filter(p => p.listingStatus === client_1.PropertyListingStatus.PENDING).length;
        const rejectedListings = properties.filter(p => p.listingStatus === client_1.PropertyListingStatus.REJECTED).length;
        // Calculate occupancy rate (properties with OCCUPIED or RENTED status)
        const occupiedProperties = properties.filter(p => p.status === client_1.PropertyStatus.OCCUPIED ||
            p.status === client_1.PropertyStatus.RENTED).length;
        const occupancyRate = totalProperties > 0
            ? Math.round((occupiedProperties / totalProperties) * 100)
            : 0;
        // Calculate sold rate
        const soldProperties = properties.filter(p => p.status === client_1.PropertyStatus.SOLD).length;
        const soldRate = totalProperties > 0
            ? Math.round((soldProperties / totalProperties) * 100)
            : 0;
        // Total properties summary
        const totalPropertiesSummary = [
            { TotalListing: totalProperties },
            { "Active Listing": activeListings },
            { "Pending Approval": pendingApproval },
            { "Rejected": rejectedListings },
            { "Occupancy rate": `${occupancyRate}%` },
            { "Sold rate": `${soldRate}%` }
        ];
        // Properties by listing type
        const propertiesByListingType = await prisma_1.default.property.groupBy({
            by: ['listingType'],
            where: { vendorId },
            _count: true
        });
        // Format listing types for response
        const formattedListingTypes = propertiesByListingType.map(item => ({
            _count: item._count,
            listingType: item.listingType
        }));
        // Get listing performance (weekly views and inquiries for the last 12 weeks)
        const listingPerformance = await this.getListingPerformance(vendorId);
        // Get recent properties (last 5)
        const recentProperties = properties.slice(0, 5).map(p => ({
            id: p.id,
            name: p.name,
            listingType: p.listingType,
            status: p.status,
            listingStatus: p.listingStatus,
            viewCount: p.viewCount,
            inquiryCount: p.inquiryCount,
            createdAt: p.createdAt,
            media: p.media
        }));
        // Get recent inquiries (last 5)
        const recentInquiries = await prisma_1.default.inquiry.findMany({
            where: { vendorId },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                inquiryNumber: true,
                name: true,
                location: true,
                message: true,
                meetingType: true,
                status: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        avatar: true
                    }
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        state: true
                    }
                }
            }
        });
        // Format recent inquiries
        const formattedRecentInquiries = recentInquiries.map(inquiry => ({
            id: inquiry.id,
            inquiryNumber: inquiry.inquiryNumber,
            userName: inquiry.user.fullName,
            propertyName: inquiry.property.name,
            propertyId: inquiry.property.id,
            location: inquiry.location,
            meetingType: inquiry.meetingType,
            status: inquiry.status,
            createdAt: inquiry.createdAt
        }));
        // Get payment statistics (aggregate from property earnings)
        const payments = await this.getPaymentStats(vendorId);
        return {
            totalProperties: totalPropertiesSummary,
            propertiesByListingType: formattedListingTypes,
            listingPerformance,
            recentProperties,
            recentInquiries: formattedRecentInquiries,
            payments
        };
    }
    /**
     * Get listing performance (weekly views and inquiries)
     * Using your existing formatDate utility
     */
    static async getListingPerformance(vendorId) {
        const now = new Date();
        const weeks = 12;
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (weeks * 7));
        // Get all properties for this vendor
        const properties = await prisma_1.default.property.findMany({
            where: { vendorId },
            select: { id: true }
        });
        const propertyIds = properties.map(p => p.id);
        if (propertyIds.length === 0) {
            return [];
        }
        // Get weekly inquiry counts
        const inquiryCounts = await prisma_1.default.$queryRaw `
      SELECT 
        DATE_TRUNC('week', "createdAt") as week_start,
        COUNT(*) as count
      FROM "Inquiry"
      WHERE "propertyId" IN (${client_1.Prisma.join(propertyIds)})
        AND "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY week_start ASC
    `;
        // Get weekly view counts from PropertyView table
        const viewCounts = await prisma_1.default.$queryRaw `
      SELECT 
        DATE_TRUNC('week', "viewedAt") as week_start,
        COUNT(*) as view_count
      FROM "PropertyView"
      WHERE "propertyId" IN (${client_1.Prisma.join(propertyIds)})
        AND "viewedAt" >= ${startDate}
      GROUP BY DATE_TRUNC('week', "viewedAt")
      ORDER BY week_start ASC
    `;
        // Helper function to format date range
        const formatDateRange = (start, end) => {
            const startStr = (0, date_utils_1.formatDate)(start);
            const endStr = (0, date_utils_1.formatDate)(end);
            return `${startStr} - ${endStr}`;
        };
        // Helper function to get short month name
        const getShortMonth = (date) => {
            return date.toLocaleDateString('en-US', { month: 'short' });
        };
        // Generate weekly performance data
        const weeksData = [];
        for (let i = 0; i < weeks; i++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() + (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            // Find inquiry count for this week
            const inquiryCount = inquiryCounts.find((item) => {
                const itemDate = new Date(item.week_start);
                return itemDate >= weekStart && itemDate <= weekEnd;
            })?.count || 0;
            // Find view count for this week
            const viewCount = viewCounts.find((item) => {
                const itemDate = new Date(item.week_start);
                return itemDate >= weekStart && itemDate <= weekEnd;
            })?.view_count || 0;
            weeksData.push({
                date: formatDateRange(weekStart, weekEnd),
                month: getShortMonth(weekStart),
                year: weekStart.getFullYear(),
                totalViews: viewCount,
                totalInquiries: inquiryCount
            });
        }
        return weeksData;
    }
    /**
     * Get payment statistics
     */
    static async getPaymentStats(vendorId) {
        // Since payments are not directly linked to vendors in this system,
        // we'll provide a structure that can be filled later
        // In a real implementation with payments, you'd query the Payment model
        return {
            summary: {
                totalCount: 0,
                totalAmount: 0,
                totalLateFees: 0,
                outstandingBalance: 0,
                currentMonth: {
                    count: 0,
                    amount: 0
                }
            },
            byStatus: {},
            byType: {},
            overdue: {
                count: 0,
                totalAmount: 0,
                totalLateFees: 0
            },
            upcoming: {
                count: 0,
                totalAmount: 0
            }
        };
    }
}
exports.VendorService = VendorService;
