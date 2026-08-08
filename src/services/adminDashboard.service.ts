import prisma from "../prisma";
import { Role, PropertyListingStatus, VerificationStatus } from "@prisma/client";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, subDays } from 'date-fns';

export class AdminDashboardService {


  static async getNINStats(): Promise<any> {
    const [pending, verified, rejected] = await Promise.all([
      prisma.user.count({
        where: {
          role: Role.VENDOR,
          ninVerificationStatus: VerificationStatus.PENDING
        }
      }),
      prisma.user.count({
        where: {
          role: Role.VENDOR,
          ninVerificationStatus: VerificationStatus.VERIFIED
        }
      }),
      prisma.user.count({
        where: {
          role: Role.VENDOR,
          ninVerificationStatus: VerificationStatus.REJECTED
        }
      })
    ]);

    // Get recent pending verifications for details
    const pendingVendors = await prisma.user.findMany({
      where: {
        role: Role.VENDOR,
        ninVerificationStatus: VerificationStatus.PENDING
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


  static async getPropertyManagementStats(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: PropertyListingStatus;
      listingType?: string;
      search?: string;
    }
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};

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


    const allProperties = await prisma.property.findMany({
      where,
      select: {
        id: true,
        listingStatus: true
      }
    });

    // Calculate stats
    const totalListings = allProperties.length;
    const pendingReviews = allProperties.filter(p => p.listingStatus === PropertyListingStatus.PENDING).length;
    const activeListings = allProperties.filter(p => p.listingStatus === PropertyListingStatus.ACTIVE).length;
    const rejectedListings = allProperties.filter(p => p.listingStatus === PropertyListingStatus.REJECTED).length;


    const properties = await prisma.property.findMany({
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

  static async getAdminDashboardOverview(): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeekDate = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const endOfWeekDate = endOfWeek(today, { weekStartsOn: 1 }); // Sunday

    // Get user counts
    const [totalUsers, activeVendors, totalProperties, pendingReviews] = await Promise.all([
      prisma.user.count({
        where: { isVerified: true, isSuspended: false }
      }),
      prisma.user.count({
        where: {
          role: Role.VENDOR,
          isVerified: true,
          isSuspended: false,
          ninVerificationStatus: VerificationStatus.VERIFIED
        }
      }),
      prisma.property.count(),
      prisma.property.count({
        where: { listingStatus: PropertyListingStatus.PENDING }
      })
    ]);

    // Get user growth for the week
    const userGrowth = await this.getUserGrowth(startOfWeekDate, endOfWeekDate);

    // Get listing growth for the week
    const listingGrowth = await this.getListingGrowth(startOfWeekDate, endOfWeekDate);

    // Get recent properties
    const recentProperties = await prisma.property.findMany({
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


  private static async getUserGrowth(startDate: Date, endDate: Date): Promise<any[]> {
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const growthData = await Promise.all(
      days.map(async (day:any) => {
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        const count = await prisma.user.count({
          where: {
            createdAt: {
              gte: day,
              lt: nextDay
            },
            isVerified: true
          }
        });

        return {
          date: format(day, 'yyyy-MM-dd'),
          day: format(day, 'EEEE'),
          dayShort: format(day, 'EEE'), 
          newUsers: count,
          totalUsers: await prisma.user.count({
            where: {
              createdAt: { lte: nextDay },
              isVerified: true
            }
          })
        };
      })
    );

    return growthData;
  }


  private static async getListingGrowth(startDate: Date, endDate: Date): Promise<any[]> {
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const growthData = await Promise.all(
      days.map(async (day:any) => {
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        const count = await prisma.property.count({
          where: {
            createdAt: {
              gte: day,
              lt: nextDay
            }
          }
        });

        return {
          date: format(day, 'yyyy-MM-dd'),
          day: format(day, 'EEEE'),
          dayShort: format(day, 'EEE'),
          newListings: count,
          totalListings: await prisma.property.count({
            where: { createdAt: { lte: nextDay } }
          })
        };
      })
    );

    return growthData;
  }


  private static getPriceDisplay(property: any): any {
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


  static async getPlatformOverview(): Promise<any> {
    const [
      totalUsers,
      totalVendors,
      totalStaff,
      totalProperties,
      activeProperties,
      pendingProperties,
      rejectedProperties,
      totalInquiries,
      totalBookings
    ] = await Promise.all([
      prisma.user.count({ where: { role: Role.USER, isVerified: true, isSuspended: false } }),
      prisma.user.count({ where: { role: Role.VENDOR, isVerified: true, isSuspended: false } }),
      prisma.user.count({ where: { role: Role.STAFF, isVerified: true, isSuspended: false } }),
      prisma.property.count(),
      prisma.property.count({ where: { listingStatus: PropertyListingStatus.ACTIVE } }),
      prisma.property.count({ where: { listingStatus: PropertyListingStatus.PENDING } }),
      prisma.property.count({ where: { listingStatus: PropertyListingStatus.REJECTED } }),
      prisma.inquiry.count(),
      prisma.shortletBooking.count()
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