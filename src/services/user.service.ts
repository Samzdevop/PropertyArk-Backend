import prisma from "../prisma";
import { hash, verify } from "argon2";
import { BadRequestError } from "../errors/BadRequestError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import Logger from "../config/logger";
import { NotFoundError } from "../errors/NotFoundError";
import { InquiryStatus, PropertyListingStatus, PropertyStatus } from "@prisma/client";
import { ForbiddenError } from "../errors/ForbiddenError";

export class UserService {
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        email: true,
        fullName: true,
      },
    });

    if (!user) {
      throw new BadRequestError("User not found");
    }

    if (!user.password) {
      throw new BadRequestError("This account uses Google login. Please use Google to sign in or set a password first.");
    }
    const isPasswordValid = await verify(user.password, currentPassword);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }
    const hashedNewPassword = await hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    Logger.info(`Password changed successfully for user: ${user.email}`);
  }

  static async getUserDashboardStats(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        location: true,
        // city: true,
        // state: true,
        // country: true
      }
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const savedProperties = await prisma.favorite.count({
      where: { userId }
    });

  
    const activeInquiries = await prisma.inquiry.count({
      where: { 
        userId,
        status: InquiryStatus.PENDING
      }
    });

    // Get occupied properties (RENTED status)
    // Since we don't have a Lease model yet, we check if user has properties with RENTED status
    // This would need a purchase/rental tracking model
    // For now, we'll use a placeholder
    const occupiedProperties = await prisma.property.count({
      where: {
        status: PropertyStatus.RENTED,
        // would need to implement a relation to track who rented it
        // For now, we'll count properties marked as RENTED
        // I might want to add a Purchase or Rental model
      }
    });

    const boughtProperties = await prisma.property.count({
      where: {
        status: PropertyStatus.SOLD
      }
    });
    const recommendedProperties = await this.getRecommendedProperties(user);
    const recentInquiries = await prisma.inquiry.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            listingType: true,
            rentAmount: true,
            salePrice: true,
            landFee: true,
            shortletAmount: true,
            media: {
              take: 1,
              where: { isPrimary: true },
              select: { url: true }
            }
          }
        },
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true
          }
        }
      }
    });

    const recentFavorites = await prisma.favorite.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            listingType: true,
            rentAmount: true,
            salePrice: true,
            landFee: true,
            shortletAmount: true,
            media: {
              take: 1,
              where: { isPrimary: true },
              select: { url: true }
            }
          }
        }
      }
    });

    return {
      userStats: {
        savedProperties,
        activeInquiries,
        occupiedProperties,
        boughtProperties
      },
      recommendedProperties: recommendedProperties.map((p: any) => ({
        ...p,
        priceDisplay: this.getPriceDisplay(p)
      })),
      recentInquiries: recentInquiries.map((i: any) => ({
        id: i.id,
        inquiryNumber: i.inquiryNumber,
        propertyName: i.property.name,
        propertyId: i.property.id,
        status: i.status,
        meetingType: i.meetingType,
        proposedDate: i.proposedDate,
        scheduledDate: i.scheduledDate,
        createdAt: i.createdAt,
        vendor: i.vendor
      })),
      recentFavorites: recentFavorites.map((f: any) => ({
        id: f.id,
        propertyId: f.propertyId,
        propertyName: f.property.name,
        propertyAddress: f.property.address,
        propertyCity: f.property.city,
        propertyState: f.property.state,
        listingType: f.property.listingType,
        priceDisplay: this.getPriceDisplay(f.property),
        image: f.property.media[0]?.url || null,
        createdAt: f.createdAt
      }))
    };
  }


  private static async getRecommendedProperties(user: any): Promise<any[]> {
    const limit = 10;
    
    const where: any = {
      listingStatus: PropertyListingStatus.ACTIVE,
      status: PropertyStatus.AVAILABLE
    };

    if (user.city && user.state) {
      where.OR = [
        { city: { contains: user.city, mode: 'insensitive' } },
        { state: { contains: user.state, mode: 'insensitive' } },
        { country: { contains: user.country || 'USA', mode: 'insensitive' } }
      ];
    } else if (user.location) {
      const locationParts = user.location.split(',').map((part: string) => part.trim());
      where.OR = [
        { city: { contains: locationParts[0] || '', mode: 'insensitive' } },
        { state: { contains: locationParts[1] || '', mode: 'insensitive' } },
        { country: { contains: locationParts[2] || 'USA', mode: 'insensitive' } }
      ];
    }

    
    let properties = await prisma.property.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        media: {
          take: 1,
          where: { isPrimary: true },
          select: { url: true }
        },
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true
          }
        },
        _count: {
          select: {
            favorites: true,
            inquiries: true
          }
        }
      }
    });

    if (properties.length === 0) {
      properties = await prisma.property.findMany({
        where: {
          listingStatus: PropertyListingStatus.ACTIVE,
          status: PropertyStatus.AVAILABLE
        },
        take: limit,
        orderBy: { viewCount: 'desc' },
        include: {
          media: {
            take: 1,
            where: { isPrimary: true },
            select: { url: true }
          },
          vendor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatar: true
            }
          },
          _count: {
            select: {
              favorites: true,
              inquiries: true
            }
          }
        }
      });
    }

    return properties;
  }

  private static getPriceDisplay(property: any): any {
    switch (property.listingType) {
      case 'FOR_RENT':
        return {
          amount: property.rentAmount,
          display: property.rentAmount ? `#${property.rentAmount.toLocaleString()}/month` : 'Contact for price',
          currency: 'NGN'
        };
      case 'FOR_SALE':
        return {
          amount: property.salePrice,
          display: property.salePrice ? `#${property.salePrice.toLocaleString()}` : 'Contact for price',
          currency: 'NGN'
        };
      case 'FOR_LAND':
        return {
          amount: property.landFee,
          display: property.landFee ? `#${property.landFee.toLocaleString()}` : 'Contact for price',
          currency: 'NGN'
        };
      case 'FOR_SHORTLET':
        return {
          amount: property.shortletAmount,
          display: property.shortletAmount ? `#${property.shortletAmount.toLocaleString()}/night` : 'Contact for price',
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


  static async getUserInquiriesStats(userId: string): Promise<any> {
    const [total, pending, accepted, declined, completed] = await Promise.all([
      prisma.inquiry.count({ where: { userId } }),
      prisma.inquiry.count({ 
        where: { 
          userId,
          status: InquiryStatus.PENDING
        } 
      }),
      prisma.inquiry.count({
        where: {
          userId,
          status: InquiryStatus.ACCEPTED
        }
      }),
      prisma.inquiry.count({
        where: {
          userId,
          status: InquiryStatus.DECLINED
        }
      }),
      prisma.inquiry.count({
        where: {
          userId,
          isCompleted: true
        }
      })
    ]);

    const upcoming = await prisma.inquiry.count({
      where: {
        userId,
        status: InquiryStatus.ACCEPTED,
        scheduledDate: { gte: new Date() },
        isCompleted: false
      }
    });


    const recentInquiries = await prisma.inquiry.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            listingType: true
          }
        },
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true
          }
        }
      }
    });

    return {
      stats: {
        total,
        pending,
        upcoming,
        accepted,
        declined,
        completed
      },
      recentInquiries: recentInquiries.map((i: any) => ({
        id: i.id,
        inquiryNumber: i.inquiryNumber,
        propertyName: i.property.name,
        propertyId: i.property.id,
        status: i.status,
        meetingType: i.meetingType,
        proposedDate: i.proposedDate,
        scheduledDate: i.scheduledDate,
        isCompleted: i.isCompleted,
        createdAt: i.createdAt,
        vendor: i.vendor
      }))
    };
  }


  static async completeInquiry(
    inquiryId: string,
    userId: string
  ): Promise<any> {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!inquiry) {
      throw new NotFoundError("Inquiry not found");
    }

    if (inquiry.userId !== userId) {
      throw new ForbiddenError("You don't have permission to complete this inquiry");
    }

    if (inquiry.status !== InquiryStatus.ACCEPTED) {
      throw new BadRequestError("Only accepted inquiries can be marked as completed");
    }

    if (inquiry.isCompleted) {
      throw new BadRequestError("Inquiry is already marked as completed");
    }

    const updatedInquiry = await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        isCompleted: true,
        completedAt: new Date()
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true
          }
        },
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    return updatedInquiry;
  }

}