"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminDashboardService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
class AdminDashboardService {
    static async getNINStats() {
        const [pending, verified, rejected] = await Promise.all([
            prisma_1.default.user.count({
                where: {
                    role: client_1.Role.VENDOR,
                    ninVerificationStatus: client_1.VerificationStatus.PENDING
                }
            }),
            prisma_1.default.user.count({
                where: {
                    role: client_1.Role.VENDOR,
                    ninVerificationStatus: client_1.VerificationStatus.VERIFIED
                }
            }),
            prisma_1.default.user.count({
                where: {
                    role: client_1.Role.VENDOR,
                    ninVerificationStatus: client_1.VerificationStatus.REJECTED
                }
            })
        ]);
        // Get recent pending verifications for details
        const pendingVendors = await prisma_1.default.user.findMany({
            where: {
                role: client_1.Role.VENDOR,
                ninVerificationStatus: client_1.VerificationStatus.PENDING
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                ninPhotoUrl: true,
                createdAt: true,
                ninVerificationStatus: true
            },
            orderBy: { createdAt: 'asc' },
            take: 10
        });
        return {
            stats: {
                pending,
                verified,
                rejected,
                total: pending + verified + rejected
            },
            pendingVendors
        };
    }
    static async getPropertyManagementStats(page = 1, limit = 20, filters) {
        const skip = (page - 1) * limit;
        const take = limit;
        const where = {};
        if (filters?.status) {
            where.listingStatus = filters.status;
        }
        if (filters?.listingType) {
            where.listingType = filters.listingType;
        }
        if (filters?.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
                { address: { contains: filters.search, mode: 'insensitive' } },
                { city: { contains: filters.search, mode: 'insensitive' } },
                { state: { contains: filters.search, mode: 'insensitive' } }
            ];
        }
        const allProperties = await prisma_1.default.property.findMany({
            where,
            select: {
                id: true,
                listingStatus: true
            }
        });
        // Calculate stats
        const totalListings = allProperties.length;
        const pendingReviews = allProperties.filter(p => p.listingStatus === client_1.PropertyListingStatus.PENDING).length;
        const activeListings = allProperties.filter(p => p.listingStatus === client_1.PropertyListingStatus.ACTIVE).length;
        const rejectedListings = allProperties.filter(p => p.listingStatus === client_1.PropertyListingStatus.REJECTED).length;
        const properties = await prisma_1.default.property.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            include: {
                vendor: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        avatar: true,
                        ninVerificationStatus: true
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
                },
                media: {
                    take: 1,
                    where: { isPrimary: true },
                    select: { url: true }
                },
                _count: {
                    select: {
                        media: true,
                        inquiries: true,
                        favorites: true,
                        shortletBookings: true
                    }
                }
            }
        });
        const formattedProperties = properties.map(property => ({
            ...property,
            priceDisplay: this.getPriceDisplay(property)
        }));
        return {
            stats: {
                totalListings,
                pendingReviews,
                activeListings,
                rejectedListings
            },
            properties: formattedProperties,
            pagination: {
                page,
                limit,
                total: allProperties.length,
                pages: Math.ceil(allProperties.length / limit)
            }
        };
    }
    static async getAdminDashboardOverview() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeekDate = (0, date_fns_1.startOfWeek)(today, { weekStartsOn: 1 }); // Monday
        const endOfWeekDate = (0, date_fns_1.endOfWeek)(today, { weekStartsOn: 1 }); // Sunday
        // Get user counts
        const [totalUsers, activeVendors, totalProperties, pendingReviews] = await Promise.all([
            prisma_1.default.user.count({
                where: { isVerified: true, isSuspended: false }
            }),
            prisma_1.default.user.count({
                where: {
                    role: client_1.Role.VENDOR,
                    isVerified: true,
                    isSuspended: false,
                    ninVerificationStatus: client_1.VerificationStatus.VERIFIED
                }
            }),
            prisma_1.default.property.count(),
            prisma_1.default.property.count({
                where: { listingStatus: client_1.PropertyListingStatus.PENDING }
            })
        ]);
        // Get user growth for the week
        const userGrowth = await this.getUserGrowth(startOfWeekDate, endOfWeekDate);
        // Get listing growth for the week
        const listingGrowth = await this.getListingGrowth(startOfWeekDate, endOfWeekDate);
        // Get recent properties
        const recentProperties = await prisma_1.default.property.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                vendor: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        avatar: true
                    }
                },
                media: {
                    take: 1,
                    where: { isPrimary: true },
                    select: { url: true }
                },
                _count: {
                    select: {
                        media: true,
                        inquiries: true,
                        favorites: true
                    }
                }
            }
        });
        // Format recent properties
        const formattedRecentProperties = recentProperties.map(property => ({
            ...property,
            priceDisplay: this.getPriceDisplay(property)
        }));
        return {
            dashboardStats: {
                totalUsers,
                activeVendors,
                totalProperties,
                pendingReviews
            },
            growthRevenue: {
                userGrowth,
                listingGrowth
            },
            properties: formattedRecentProperties
        };
    }
    static async getUserGrowth(startDate, endDate) {
        const days = (0, date_fns_1.eachDayOfInterval)({ start: startDate, end: endDate });
        const growthData = await Promise.all(days.map(async (day) => {
            const nextDay = new Date(day);
            nextDay.setDate(nextDay.getDate() + 1);
            const count = await prisma_1.default.user.count({
                where: {
                    createdAt: {
                        gte: day,
                        lt: nextDay
                    },
                    isVerified: true
                }
            });
            return {
                date: (0, date_fns_1.format)(day, 'yyyy-MM-dd'),
                day: (0, date_fns_1.format)(day, 'EEEE'),
                dayShort: (0, date_fns_1.format)(day, 'EEE'),
                newUsers: count,
                totalUsers: await prisma_1.default.user.count({
                    where: {
                        createdAt: { lte: nextDay },
                        isVerified: true
                    }
                })
            };
        }));
        return growthData;
    }
    static async getListingGrowth(startDate, endDate) {
        const days = (0, date_fns_1.eachDayOfInterval)({ start: startDate, end: endDate });
        const growthData = await Promise.all(days.map(async (day) => {
            const nextDay = new Date(day);
            nextDay.setDate(nextDay.getDate() + 1);
            const count = await prisma_1.default.property.count({
                where: {
                    createdAt: {
                        gte: day,
                        lt: nextDay
                    }
                }
            });
            return {
                date: (0, date_fns_1.format)(day, 'yyyy-MM-dd'),
                day: (0, date_fns_1.format)(day, 'EEEE'),
                dayShort: (0, date_fns_1.format)(day, 'EEE'),
                newListings: count,
                totalListings: await prisma_1.default.property.count({
                    where: { createdAt: { lte: nextDay } }
                })
            };
        }));
        return growthData;
    }
    static getPriceDisplay(property) {
        switch (property.listingType) {
            case 'FOR_RENT':
                return {
                    amount: property.rentAmount,
                    display: property.rentAmount ? `$${property.rentAmount.toLocaleString()}/month` : 'Contact for price',
                    currency: 'NGN'
                };
            case 'FOR_SALE':
                return {
                    amount: property.salePrice,
                    display: property.salePrice ? `$${property.salePrice.toLocaleString()}` : 'Contact for price',
                    currency: 'NGN'
                };
            case 'FOR_LAND':
                return {
                    amount: property.landFee,
                    display: property.landFee ? `$${property.landFee.toLocaleString()}` : 'Contact for price',
                    currency: 'NGN'
                };
            case 'FOR_SHORTLET':
                return {
                    amount: property.shortletAmount,
                    display: property.shortletAmount ? `$${property.shortletAmount.toLocaleString()}/night` : 'Contact for price',
                    currency: 'NGN'
                };
            default:
                return {
                    amount: null,
                    display: 'Contact for price',
                    currency: 'NGN'
                };
        }
    }
    static async getPlatformOverview() {
        const [totalUsers, totalVendors, totalStaff, totalProperties, activeProperties, pendingProperties, rejectedProperties, totalInquiries, totalBookings] = await Promise.all([
            prisma_1.default.user.count({ where: { role: client_1.Role.USER, isVerified: true, isSuspended: false } }),
            prisma_1.default.user.count({ where: { role: client_1.Role.VENDOR, isVerified: true, isSuspended: false } }),
            prisma_1.default.user.count({ where: { role: client_1.Role.STAFF, isVerified: true, isSuspended: false } }),
            prisma_1.default.property.count(),
            prisma_1.default.property.count({ where: { listingStatus: client_1.PropertyListingStatus.ACTIVE } }),
            prisma_1.default.property.count({ where: { listingStatus: client_1.PropertyListingStatus.PENDING } }),
            prisma_1.default.property.count({ where: { listingStatus: client_1.PropertyListingStatus.REJECTED } }),
            prisma_1.default.inquiry.count(),
            prisma_1.default.shortletBooking.count()
        ]);
        return {
            users: {
                total: totalUsers + totalVendors + totalStaff,
                users: totalUsers,
                vendors: totalVendors,
                staff: totalStaff
            },
            properties: {
                total: totalProperties,
                active: activeProperties,
                pending: pendingProperties,
                rejected: rejectedProperties
            },
            engagement: {
                totalInquiries,
                totalBookings
            }
        };
    }
}
exports.AdminDashboardService = AdminDashboardService;
