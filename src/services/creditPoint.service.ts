import prisma from "../prisma";
import { Role, CreditTransactionType, CreditTransactionStatus, PaymentStatus } from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import Logger from "../config/logger";


export class CreditPointService {

  private static generateTransactionNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CRT-${year}-${random}`;
  }

  private static generatePurchaseNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PUR-${year}-${random}`;
  }


  static async getSettings(): Promise<any> {
    let settings = await prisma.creditPointSettings.findFirst({
      where: { isActive: true }
    });

    if (!settings) {
      settings = await prisma.creditPointSettings.create({
        data: {
          newVendorBonusPoints: 10,
          newVendorBonusExpiryDays: 30,
          propertyCreationCost: 5,
          featurePropertyCost: 10,
          featurePropertyDurationDays: 30,
          minimumPurchasePoints: 10,
          pricePerPoint: 500,
          currency: 'NGN',
          isActive: true,
          updatedBy: 'system'
        }
      });
    }

    return settings;
  }

  static async updateSettings(
    adminId: string,
    data: {
      newVendorBonusPoints?: number;
      newVendorBonusExpiryDays?: number;
      propertyCreationCost?: number;
      featurePropertyCost?: number;
      featurePropertyDurationDays?: number;
      minimumPurchasePoints?: number;
      pricePerPoint?: number;
      currency?: string;
    }
  ): Promise<any> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });

    if (!admin || admin.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can update credit point settings");
    }
    let settings = await prisma.creditPointSettings.findFirst({
      where: { isActive: true }
    });

    if (data.newVendorBonusPoints !== undefined && data.newVendorBonusPoints < 0) {
      throw new BadRequestError("New vendor bonus points cannot be negative");
    }
    if (data.propertyCreationCost !== undefined && data.propertyCreationCost < 0) {
      throw new BadRequestError("Property creation cost cannot be negative");
    }
    if (data.featurePropertyCost !== undefined && data.featurePropertyCost < 0) {
      throw new BadRequestError("Feature property cost cannot be negative");
    }
    if (data.minimumPurchasePoints !== undefined && data.minimumPurchasePoints < 1) {
      throw new BadRequestError("Minimum purchase points must be at least 1");
    }
    if (data.pricePerPoint !== undefined && data.pricePerPoint <= 0) {
      throw new BadRequestError("Price per point must be greater than 0");
    }

    if (settings) {
      settings = await prisma.creditPointSettings.update({
        where: { id: settings.id },
        data: {
          ...data,
          updatedBy: adminId
        }
      });
    } else {
      settings = await prisma.creditPointSettings.create({
        data: {
          ...data,
          updatedBy: adminId,
          isActive: true
        }
      });
    }

    Logger.info(`Admin ${adminId} updated credit point settings`);
    return settings;
  }

  static async addCreditPoints(
    userId: string,
    points: number,
    type: CreditTransactionType,
    description: string,
    options?: {
      expiresAt?: Date;
      amountPaid?: number;
      paymentReference?: string;
      propertyId?: string;
      metadata?: any;
    }
  ): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, creditPoints: true }
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (points <= 0) {
      throw new BadRequestError("Points must be greater than 0");
    }

    const balanceBefore = user.creditPoints;
    const balanceAfter = balanceBefore + points;

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditPoints: balanceAfter,
          creditPointsPurchased: type === CreditTransactionType.PURCHASE 
            ? { increment: points } 
            : undefined
        }
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          transactionNumber: this.generateTransactionNumber(),
          userId,
          type,
          status: CreditTransactionStatus.COMPLETED,
          points,
          balanceBefore,
          balanceAfter,
          amountPaid: options?.amountPaid,
          currency: 'NGN',
          paymentReference: options?.paymentReference,
          paymentStatus: options?.paymentReference ? PaymentStatus.SUCCESS : undefined,
          propertyId: options?.propertyId,
          description,
          metadata: options?.metadata,
          expiresAt: options?.expiresAt
        }
      });

      return { user: updatedUser, transaction };
    });

    Logger.info(`Added ${points} credit points to user ${userId}. Type: ${type}`);
    return result;
  }

  static async deductCreditPoints(
    userId: string,
    points: number,
    type: CreditTransactionType,
    description: string,
    options?: {
      propertyId?: string;
      metadata?: any;
    }
  ): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, creditPoints: true }
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (points <= 0) {
      throw new BadRequestError("Points must be greater than 0");
    }

    if (user.creditPoints < points) {
      throw new BadRequestError(
        `Insufficient credit points. You have ${user.creditPoints} points but need ${points} points. Kindly purchase more points.`
      );
    }

    const balanceBefore = user.creditPoints;
    const balanceAfter = balanceBefore - points;

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditPoints: balanceAfter,
          creditPointsUsed: { increment: points }
        }
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          transactionNumber: this.generateTransactionNumber(),
          userId,
          type,
          status: CreditTransactionStatus.COMPLETED,
          points: -points,
          balanceBefore,
          balanceAfter,
          propertyId: options?.propertyId,
          description,
          metadata: options?.metadata
        }
      });

      return { user: updatedUser, transaction };
    });

    Logger.info(`Deducted ${points} credit points from user ${userId}. Type: ${type}`);
    return result;
  }


  static async awardNewVendorBonus(vendorId: string): Promise<any> {
    const settings = await this.getSettings();

    if (settings.newVendorBonusPoints <= 0) {
      return null;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + settings.newVendorBonusExpiryDays);

    return this.addCreditPoints(
      vendorId,
      settings.newVendorBonusPoints,
      CreditTransactionType.ADMIN_ADJUSTMENT,
      `Welcome bonus for new vendor (${settings.newVendorBonusPoints} points)`,
      {
        expiresAt,
        metadata: {
          isWelcomeBonus: true,
          expiryDays: settings.newVendorBonusExpiryDays
        }
      }
    );
  }

 
  static async canCreateProperty(vendorId: string): Promise<{
    canCreate: boolean;
    currentPoints: number;
    requiredPoints: number;
    message?: string;
  }> {
    const settings = await this.getSettings();
    
    const user = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { creditPoints: true }
    });

    if (!user) {
      throw new NotFoundError("Vendor not found");
    }

    const canCreate = user.creditPoints >= settings.propertyCreationCost;

    return {
      canCreate,
      currentPoints: user.creditPoints,
      requiredPoints: settings.propertyCreationCost,
      message: canCreate 
        ? undefined 
        : `Insufficient credit points. You have ${user.creditPoints} points but need ${settings.propertyCreationCost} points to create a property. Kindly purchase more points.`
    };
  }

 
  static async canFeatureProperty(vendorId: string): Promise<{
    canFeature: boolean;
    currentPoints: number;
    requiredPoints: number;
    message?: string;
  }> {
    const settings = await this.getSettings();
    
    const user = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { creditPoints: true }
    });

    if (!user) {
      throw new NotFoundError("Vendor not found");
    }

    const canFeature = user.creditPoints >= settings.featurePropertyCost;

    return {
      canFeature,
      currentPoints: user.creditPoints,
      requiredPoints: settings.featurePropertyCost,
      message: canFeature 
        ? undefined 
        : `Insufficient credit points. You have ${user.creditPoints} points but need ${settings.featurePropertyCost} points to feature a property. Kindly purchase more points.`
    };
  }


  static async getUserCreditInfo(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [user, transactions, total] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          creditPoints: true,
          creditPointsUsed: true,
          creditPointsPurchased: true
        }
      }),
      prisma.creditTransaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.creditTransaction.count({ where: { userId } })
    ]);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const settings = await this.getSettings();

    return {
      balance: {
        current: user.creditPoints,
        totalUsed: user.creditPointsUsed,
        totalPurchased: user.creditPointsPurchased
      },
      settings: {
        propertyCreationCost: settings.propertyCreationCost,
        featurePropertyCost: settings.featurePropertyCost,
        minimumPurchasePoints: settings.minimumPurchasePoints,
        pricePerPoint: settings.pricePerPoint,
        currency: settings.currency
      },
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }


  static async calculatePurchaseAmount(points: number): Promise<{
    points: number;
    pricePerPoint: number;
    totalAmount: number;
    currency: string;
  }> {
    const settings = await this.getSettings();

    if (points < settings.minimumPurchasePoints) {
      throw new BadRequestError(
        `Minimum purchase is ${settings.minimumPurchasePoints} points. You requested ${points} points.`
      );
    }

    if (points % 1 !== 0) {
      throw new BadRequestError("Points must be a whole number");
    }

    const totalAmount = points * settings.pricePerPoint;

    return {
      points,
      pricePerPoint: settings.pricePerPoint,
      totalAmount,
      currency: settings.currency
    };
  }


  static async featureProperty(
    propertyId: string,
    vendorId: string
  ): Promise<any> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        vendorId: true,
        isFeatured: true
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (property.vendorId !== vendorId) {
      throw new ForbiddenError("You don't have permission to feature this property");
    }

    if (property.isFeatured) {
      throw new BadRequestError("Property is already featured");
    }

    const check = await this.canFeatureProperty(vendorId);
    if (!check.canFeature) {
      throw new BadRequestError(check.message);
    }

    const settings = await this.getSettings();
    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + settings.featurePropertyDurationDays);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: vendorId },
        select: { creditPoints: true }
      });

      if (!user) {
        throw new NotFoundError("Vendor not found");
      }

      const balanceBefore = user.creditPoints;
      const balanceAfter = balanceBefore - settings.featurePropertyCost;

      if (balanceAfter < 0) {
        throw new BadRequestError("Insufficient credit points. Kindly purchase more points.");
      }
      
      await tx.user.update({
        where: { id: vendorId },
        data: {
          creditPoints: balanceAfter,
          creditPointsUsed: { increment: settings.featurePropertyCost }
        }
      });

      await tx.creditTransaction.create({
        data: {
          transactionNumber: this.generateTransactionNumber(),
          userId: vendorId,
          type: CreditTransactionType.FEATURE_PROPERTY,
          status: CreditTransactionStatus.COMPLETED,
          points: -settings.featurePropertyCost,
          balanceBefore,
          balanceAfter,
          propertyId,
          description: `Featured property: ${property.name} for ${settings.featurePropertyDurationDays} days`,
          metadata: {
            featuredUntil,
            durationDays: settings.featurePropertyDurationDays
          }
        }
      });
      const updatedProperty = await tx.property.update({
        where: { id: propertyId },
        data: {
          isFeatured: true,
          featuredAt: new Date(),
          featuredUntil
        },
        include: {
          media: {
            take: 1,
            where: { isPrimary: true },
            select: { url: true }
          }
        }
      });

      return updatedProperty;
    });

    Logger.info(`Property ${propertyId} featured by vendor ${vendorId}`);
    return result;
  }


  static async unfeatureProperty(
    propertyId: string,
    adminId: string
  ): Promise<any> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });

    if (!admin || admin.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can unfeature properties");
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, isFeatured: true }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (!property.isFeatured) {
      throw new BadRequestError("Property is not featured");
    }

    const updatedProperty = await prisma.property.update({
      where: { id: propertyId },
      data: {
        isFeatured: false,
        featuredAt: null,
        featuredUntil: null,
        featuredBy: adminId
      },
      include: {
        media: {
          take: 1,
          where: { isPrimary: true },
          select: { url: true }
        }
      }
    });

    Logger.info(`Property ${propertyId} unfeatured by admin ${adminId}`);
    return updatedProperty;
  }


  static async getFeaturedProperties(): Promise<any> {
    const now = new Date();

    const properties = await prisma.property.findMany({
      where: {
        isFeatured: true,
        listingStatus: 'ACTIVE',
        OR: [
          { featuredUntil: null },
          { featuredUntil: { gte: now } }
        ]
      },
      orderBy: { featuredAt: 'desc' },
      include: {
        media: {
          orderBy: { isPrimary: 'desc' },
          take: 5
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

    return properties;
  }


  static async cleanupExpiredFeatured(): Promise<number> {
    const now = new Date();

    const result = await prisma.property.updateMany({
      where: {
        isFeatured: true,
        featuredUntil: { lt: now }
      },
      data: {
        isFeatured: false,
        featuredAt: null,
        featuredUntil: null
      }
    });

    if (result.count > 0) {
      Logger.info(`Cleaned up ${result.count} expired featured properties`);
    }

    return result.count;
  }
}