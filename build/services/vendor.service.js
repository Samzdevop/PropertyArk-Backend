"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const date_utils_1 = require("../utils/date.utils");
const BadRequestError_1 = require("../errors/BadRequestError");
const NotFoundError_1 = require("../errors/NotFoundError");
const logger_1 = __importDefault(require("../config/logger"));
class VendorService {
    static async getDashboardStats(vendorId) {
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
        const soldProperties = properties.filter(p => p.status === client_1.PropertyStatus.SOLD).length;
        const soldRate = totalProperties > 0
            ? Math.round((soldProperties / totalProperties) * 100)
            : 0;
        const totalPropertiesSummary = [
            { TotalListing: totalProperties },
            { "Active Listing": activeListings },
            { "Pending Approval": pendingApproval },
            { "Rejected": rejectedListings },
            { "Occupancy rate": `${occupancyRate}%` },
            { "Sold rate": `${soldRate}%` }
        ];
        const propertiesByListingType = await prisma_1.default.property.groupBy({
            by: ['listingType'],
            where: { vendorId },
            _count: true
        });
        const formattedListingTypes = propertiesByListingType.map(item => ({
            _count: item._count,
            listingType: item.listingType
        }));
        const listingPerformance = await this.getListingPerformance(vendorId);
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
        const weeksData = [];
        for (let i = 0; i < weeks; i++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() + (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const inquiryCount = inquiryCounts.find((item) => {
                const itemDate = new Date(item.week_start);
                return itemDate >= weekStart && itemDate <= weekEnd;
            })?.count || 0;
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
    static async getPaymentStats(vendorId) {
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
    static async setAvailability(vendorId, slots) {
        const vendor = await prisma_1.default.user.findUnique({
            where: { id: vendorId },
            select: { id: true, role: true }
        });
        if (!vendor) {
            throw new NotFoundError_1.NotFoundError("Vendor not found");
        }
        for (const slot of slots) {
            if (!slot.date || isNaN(slot.date.getTime())) {
                throw new BadRequestError_1.BadRequestError("Invalid date format");
            }
            if (!this.isValidTime(slot.startTime) || !this.isValidTime(slot.endTime)) {
                throw new BadRequestError_1.BadRequestError("Invalid time format. Use HH:mm (e.g., 09:00)");
            }
            if (slot.startTime >= slot.endTime) {
                throw new BadRequestError_1.BadRequestError("Start time must be before end time");
            }
            // Check if date is in the past
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (slot.date < today) {
                throw new BadRequestError_1.BadRequestError(`Date ${slot.date.toLocaleDateString()} is in the past`);
            }
        }
        // Delete existing availability for these specific dates
        const dates = slots.map(slot => slot.date);
        await prisma_1.default.vendorAvailability.deleteMany({
            where: {
                vendorId,
                date: { in: dates }
            }
        });
        // Create new availability slots
        const createdSlots = await prisma_1.default.vendorAvailability.createMany({
            data: slots.map(slot => ({
                vendorId,
                date: new Date(slot.date.setHours(0, 0, 0, 0)),
                startTime: slot.startTime,
                endTime: slot.endTime,
                isRecurring: slot.isRecurring || false,
                dayOfWeek: slot.dayOfWeek || null,
                isActive: true
            }))
        });
        logger_1.default.info(`Vendor ${vendorId} set ${slots.length} availability slots`);
        return prisma_1.default.vendorAvailability.findMany({
            where: {
                vendorId,
                date: { in: dates }
            },
            orderBy: { date: 'asc' }
        });
    }
    static async getVendorAvailabilitySlots(vendorId) {
        const slots = await prisma_1.default.vendorAvailability.findMany({
            where: {
                vendorId,
                isActive: true
            },
            orderBy: { date: 'asc' }
        });
        const groupedSlots = {};
        slots.forEach(slot => {
            const dateKey = slot.date.toISOString().split('T')[0];
            if (!groupedSlots[dateKey]) {
                groupedSlots[dateKey] = [];
            }
            groupedSlots[dateKey].push({
                startTime: slot.startTime,
                endTime: slot.endTime,
                isActive: slot.isActive
            });
        });
        return Object.entries(groupedSlots).map(([date, slots]) => ({
            date,
            slots
        }));
    }
    static async getUpcomingAvailability(vendorId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const slots = await prisma_1.default.vendorAvailability.findMany({
            where: {
                vendorId,
                date: {
                    gte: today,
                    lte: nextWeek
                },
                isActive: true
            },
            orderBy: { date: 'asc' }
        });
        // Group by date
        const grouped = this.groupAvailabilityByDate(slots);
        return grouped;
    }
    static async addAvailability(vendorId, slot) {
        // Validate vendor exists
        const vendor = await prisma_1.default.user.findUnique({
            where: { id: vendorId },
            select: { id: true, role: true }
        });
        if (!vendor) {
            throw new NotFoundError_1.NotFoundError("Vendor not found");
        }
        // Validate slot
        if (!slot.date || isNaN(slot.date.getTime())) {
            throw new BadRequestError_1.BadRequestError("Invalid date format");
        }
        if (!this.isValidTime(slot.startTime) || !this.isValidTime(slot.endTime)) {
            throw new BadRequestError_1.BadRequestError("Invalid time format. Use HH:mm (e.g., 09:00)");
        }
        if (slot.startTime >= slot.endTime) {
            throw new BadRequestError_1.BadRequestError("Start time must be before end time");
        }
        // Check if date is in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (slot.date < today) {
            throw new BadRequestError_1.BadRequestError(`Date ${slot.date.toLocaleDateString()} is in the past`);
        }
        // Check if slot already exists for this date
        const existing = await prisma_1.default.vendorAvailability.findFirst({
            where: {
                vendorId,
                date: new Date(slot.date.setHours(0, 0, 0, 0)),
                startTime: slot.startTime,
                endTime: slot.endTime
            }
        });
        if (existing) {
            throw new BadRequestError_1.BadRequestError("This time slot already exists for this date");
        }
        // Create availability slot
        const created = await prisma_1.default.vendorAvailability.create({
            data: {
                vendorId,
                date: new Date(slot.date.setHours(0, 0, 0, 0)),
                startTime: slot.startTime,
                endTime: slot.endTime,
                isRecurring: slot.isRecurring || false,
                dayOfWeek: slot.dayOfWeek || null,
                isActive: true
            }
        });
        logger_1.default.info(`Vendor ${vendorId} added availability for ${slot.date.toLocaleDateString()}`);
        return created;
    }
    static async getAvailability(vendorId, startDate, endDate) {
        const where = {
            vendorId,
            isActive: true
        };
        if (startDate) {
            where.date = { gte: new Date(startDate.setHours(0, 0, 0, 0)) };
        }
        if (endDate) {
            where.date = { ...where.date, lte: new Date(endDate.setHours(23, 59, 59, 999)) };
        }
        const availability = await prisma_1.default.vendorAvailability.findMany({
            where,
            orderBy: { date: 'asc' }
        });
        // Group by date
        const grouped = this.groupAvailabilityByDate(availability);
        return {
            vendorId,
            availability: grouped,
            allSlots: availability
        };
    }
    static async getAvailableSlotsForDate(vendorId, date) {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const slots = await prisma_1.default.vendorAvailability.findMany({
            where: {
                vendorId,
                date: targetDate,
                isActive: true
            },
            orderBy: { startTime: 'asc' }
        });
        return {
            date: targetDate,
            available: slots.length > 0,
            slots: slots.map((slot) => ({
                id: slot.id,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isRecurring: slot.isRecurring
            }))
        };
    }
    static async isAvailable(vendorId, dateTime) {
        const targetDate = new Date(dateTime);
        targetDate.setHours(0, 0, 0, 0);
        const timeStr = this.formatTime(dateTime);
        const slot = await prisma_1.default.vendorAvailability.findFirst({
            where: {
                vendorId,
                date: targetDate,
                startTime: { lte: timeStr },
                endTime: { gte: timeStr },
                isActive: true
            }
        });
        return !!slot;
    }
    static async updateAvailabilitySlot(vendorId, slotId, data) {
        const slot = await prisma_1.default.vendorAvailability.findFirst({
            where: {
                id: slotId,
                vendorId
            }
        });
        if (!slot) {
            throw new NotFoundError_1.NotFoundError("Availability slot not found");
        }
        if (data.startTime && !this.isValidTime(data.startTime)) {
            throw new BadRequestError_1.BadRequestError("Invalid start time format");
        }
        if (data.endTime && !this.isValidTime(data.endTime)) {
            throw new BadRequestError_1.BadRequestError("Invalid end time format");
        }
        if (data.startTime && data.endTime && data.startTime >= data.endTime) {
            throw new BadRequestError_1.BadRequestError("Start time must be before end time");
        }
        const updated = await prisma_1.default.vendorAvailability.update({
            where: { id: slotId },
            data: {
                ...(data.date && { date: new Date(data.date.setHours(0, 0, 0, 0)) }),
                ...(data.startTime && { startTime: data.startTime }),
                ...(data.endTime && { endTime: data.endTime }),
                ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
                ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek })
            }
        });
        logger_1.default.info(`Vendor ${vendorId} updated availability slot ${slotId}`);
        return updated;
    }
    static async deleteAvailabilitySlot(vendorId, slotId) {
        const slot = await prisma_1.default.vendorAvailability.findFirst({
            where: {
                id: slotId,
                vendorId
            }
        });
        if (!slot) {
            throw new NotFoundError_1.NotFoundError("Availability slot not found");
        }
        await prisma_1.default.vendorAvailability.delete({
            where: { id: slotId }
        });
        logger_1.default.info(`Vendor ${vendorId} deleted availability slot ${slotId}`);
    }
    static async toggleAvailability(vendorId, slotId) {
        const slot = await prisma_1.default.vendorAvailability.findFirst({
            where: {
                id: slotId,
                vendorId
            }
        });
        if (!slot) {
            throw new NotFoundError_1.NotFoundError("Availability slot not found");
        }
        const updated = await prisma_1.default.vendorAvailability.update({
            where: { id: slotId },
            data: { isActive: !slot.isActive }
        });
        logger_1.default.info(`Vendor ${vendorId} ${updated.isActive ? 'activated' : 'deactivated'} slot ${slotId}`);
        return updated;
    }
    static async bulkDeleteAvailability(vendorId, dates) {
        const result = await prisma_1.default.vendorAvailability.deleteMany({
            where: {
                vendorId,
                date: { in: dates }
            }
        });
        logger_1.default.info(`Vendor ${vendorId} deleted ${result.count} availability slots`);
        return result.count;
    }
    static groupAvailabilityByDate(availability) {
        const grouped = {};
        availability.forEach(slot => {
            const dateKey = slot.date.toISOString().split('T')[0];
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push({
                id: slot.id,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isRecurring: slot.isRecurring,
                isActive: slot.isActive
            });
        });
        return grouped;
    }
    static isValidTime(time) {
        const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regex.test(time);
    }
    static formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }
}
exports.VendorService = VendorService;
