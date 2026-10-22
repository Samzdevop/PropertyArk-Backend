"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditPointService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const BadRequestError_1 = require("../errors/BadRequestError");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const logger_1 = __importDefault(require("../config/logger"));
class CreditPointService {
    static generateTransactionNumber() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `CRT-${year}-${random}`;
    }
    static generatePurchaseNumber() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `PUR-${year}-${random}`;
    }
    static async getSettings() {
        let settings = await prisma_1.default.creditPointSettings.findFirst({
            where: { isActive: true }
        });
        if (!settings) {
            settings = await prisma_1.default.creditPointSettings.create({
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
    static async updateSettings(adminId, data) {
        const admin = await prisma_1.default.user.findUnique({
            where: { id: adminId },
            select: { role: true }
        });
        if (!admin || admin.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can update credit point settings");
        }
        let settings = await prisma_1.default.creditPointSettings.findFirst({
            where: { isActive: true }
        });
        if (data.newVendorBonusPoints !== undefined && data.newVendorBonusPoints < 0) {
            throw new BadRequestError_1.BadRequestError("New vendor bonus points cannot be negative");
        }
        if (data.propertyCreationCost !== undefined && data.propertyCreationCost < 0) {
            throw new BadRequestError_1.BadRequestError("Property creation cost cannot be negative");
        }
        if (data.featurePropertyCost !== undefined && data.featurePropertyCost < 0) {
            throw new BadRequestError_1.BadRequestError("Feature property cost cannot be negative");
        }
        if (data.minimumPurchasePoints !== undefined && data.minimumPurchasePoints < 1) {
            throw new BadRequestError_1.BadRequestError("Minimum purchase points must be at least 1");
        }
        if (data.pricePerPoint !== undefined && data.pricePerPoint <= 0) {
            throw new BadRequestError_1.BadRequestError("Price per point must be greater than 0");
        }
        if (settings) {
            settings = await prisma_1.default.creditPointSettings.update({
                where: { id: settings.id },
                data: {
                    ...data,
                    updatedBy: adminId
                }
            });
        }
        else {
            settings = await prisma_1.default.creditPointSettings.create({
                data: {
                    ...data,
                    updatedBy: adminId,
                    isActive: true
                }
            });
        }
        logger_1.default.info(`Admin ${adminId} updated credit point settings`);
        return settings;
    }
    static async addCreditPoints(userId, points, type, description, options) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, creditPoints: true }
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError("User not found");
        }
        if (points <= 0) {
            throw new BadRequestError_1.BadRequestError("Points must be greater than 0");
        }
        const balanceBefore = user.creditPoints;
        const balanceAfter = balanceBefore + points;
        const result = await prisma_1.default.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    creditPoints: balanceAfter,
                    creditPointsPurchased: type === client_1.CreditTransactionType.PURCHASE
                        ? { increment: points }
                        : undefined
                }
            });
            const transaction = await tx.creditTransaction.create({
                data: {
                    transactionNumber: this.generateTransactionNumber(),
                    userId,
                    type,
                    status: client_1.CreditTransactionStatus.COMPLETED,
                    points,
                    balanceBefore,
                    balanceAfter,
                    amountPaid: options?.amountPaid,
                    currency: 'NGN',
                    paymentReference: options?.paymentReference,
                    paymentStatus: options?.paymentReference ? client_1.PaymentStatus.SUCCESS : undefined,
                    propertyId: options?.propertyId,
                    description,
                    metadata: options?.metadata,
                    expiresAt: options?.expiresAt
                }
            });
            return { user: updatedUser, transaction };
        });
        logger_1.default.info(`Added ${points} credit points to user ${userId}. Type: ${type}`);
        return result;
    }
    static async deductCreditPoints(userId, points, type, description, options) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, creditPoints: true }
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError("User not found");
        }
        if (points <= 0) {
            throw new BadRequestError_1.BadRequestError("Points must be greater than 0");
        }
        if (user.creditPoints < points) {
            throw new BadRequestError_1.BadRequestError(`Insufficient credit points. You have ${user.creditPoints} points but need ${points} points. Kindly purchase more points.`);
        }
        const balanceBefore = user.creditPoints;
        const balanceAfter = balanceBefore - points;
        const result = await prisma_1.default.$transaction(async (tx) => {
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
                    status: client_1.CreditTransactionStatus.COMPLETED,
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
        logger_1.default.info(`Deducted ${points} credit points from user ${userId}. Type: ${type}`);
        return result;
    }
    static async awardNewVendorBonus(vendorId) {
        const settings = await this.getSettings();
        if (settings.newVendorBonusPoints <= 0) {
            return null;
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + settings.newVendorBonusExpiryDays);
        return this.addCreditPoints(vendorId, settings.newVendorBonusPoints, client_1.CreditTransactionType.ADMIN_ADJUSTMENT, `Welcome bonus for new vendor (${settings.newVendorBonusPoints} points)`, {
            expiresAt,
            metadata: {
                isWelcomeBonus: true,
                expiryDays: settings.newVendorBonusExpiryDays
            }
        });
    }
    static async canCreateProperty(vendorId) {
        const settings = await this.getSettings();
        const user = await prisma_1.default.user.findUnique({
            where: { id: vendorId },
            select: { creditPoints: true }
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError("Vendor not found");
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
    static async canFeatureProperty(vendorId) {
        const settings = await this.getSettings();
        const user = await prisma_1.default.user.findUnique({
            where: { id: vendorId },
            select: { creditPoints: true }
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError("Vendor not found");
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
    static async getUserCreditInfo(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [user, transactions, total] = await Promise.all([
            prisma_1.default.user.findUnique({
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
            prisma_1.default.creditTransaction.findMany({
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
            prisma_1.default.creditTransaction.count({ where: { userId } })
        ]);
        if (!user) {
            throw new NotFoundError_1.NotFoundError("User not found");
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
    static async calculatePurchaseAmount(points) {
        const settings = await this.getSettings();
        if (points < settings.minimumPurchasePoints) {
            throw new BadRequestError_1.BadRequestError(`Minimum purchase is ${settings.minimumPurchasePoints} points. You requested ${points} points.`);
        }
        if (points % 1 !== 0) {
            throw new BadRequestError_1.BadRequestError("Points must be a whole number");
        }
        const totalAmount = points * settings.pricePerPoint;
        return {
            points,
            pricePerPoint: settings.pricePerPoint,
            totalAmount,
            currency: settings.currency
        };
    }
    static async featureProperty(propertyId, vendorId) {
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            select: {
                id: true,
                name: true,
                vendorId: true,
                isFeatured: true
            }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        if (property.vendorId !== vendorId) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to feature this property");
        }
        if (property.isFeatured) {
            throw new BadRequestError_1.BadRequestError("Property is already featured");
        }
        const check = await this.canFeatureProperty(vendorId);
        if (!check.canFeature) {
            throw new BadRequestError_1.BadRequestError(check.message);
        }
        const settings = await this.getSettings();
        const featuredUntil = new Date();
        featuredUntil.setDate(featuredUntil.getDate() + settings.featurePropertyDurationDays);
        const result = await prisma_1.default.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: vendorId },
                select: { creditPoints: true }
            });
            if (!user) {
                throw new NotFoundError_1.NotFoundError("Vendor not found");
            }
            const balanceBefore = user.creditPoints;
            const balanceAfter = balanceBefore - settings.featurePropertyCost;
            if (balanceAfter < 0) {
                throw new BadRequestError_1.BadRequestError("Insufficient credit points. Kindly purchase more points.");
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
                    type: client_1.CreditTransactionType.FEATURE_PROPERTY,
                    status: client_1.CreditTransactionStatus.COMPLETED,
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
        logger_1.default.info(`Property ${propertyId} featured by vendor ${vendorId}`);
        return result;
    }
    static async unfeatureProperty(propertyId, adminId) {
        const admin = await prisma_1.default.user.findUnique({
            where: { id: adminId },
            select: { role: true }
        });
        if (!admin || admin.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can unfeature properties");
        }
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            select: { id: true, name: true, isFeatured: true }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        if (!property.isFeatured) {
            throw new BadRequestError_1.BadRequestError("Property is not featured");
        }
        const updatedProperty = await prisma_1.default.property.update({
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
        logger_1.default.info(`Property ${propertyId} unfeatured by admin ${adminId}`);
        return updatedProperty;
    }
    static async getFeaturedProperties() {
        const now = new Date();
        const properties = await prisma_1.default.property.findMany({
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
    static async cleanupExpiredFeatured() {
        const now = new Date();
        const result = await prisma_1.default.property.updateMany({
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
            logger_1.default.info(`Cleaned up ${result.count} expired featured properties`);
        }
        return result.count;
    }
    static async adminGiftCreditPoints(adminId, data) {
        const { vendorIds, points, name, expiresAt, reason } = data;
        const admin = await prisma_1.default.user.findUnique({
            where: { id: adminId },
            select: { id: true, role: true, fullName: true }
        });
        if (!admin || admin.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can gift credit points");
        }
        if (!points || points <= 0) {
            throw new BadRequestError_1.BadRequestError("Points must be greater than 0");
        }
        if (!name || name.trim().length === 0) {
            throw new BadRequestError_1.BadRequestError("A name for the credit grant is required");
        }
        let targetVendors = [];
        if (vendorIds && vendorIds.length > 0) {
            targetVendors = await prisma_1.default.user.findMany({
                where: {
                    id: { in: vendorIds },
                    role: client_1.Role.VENDOR,
                    isVerified: true,
                    isSuspended: false,
                    isDeleted: false
                },
                select: { id: true, email: true, fullName: true, creditPoints: true }
            });
            if (targetVendors.length !== vendorIds.length) {
                const foundIds = targetVendors.map(v => v.id);
                const missing = vendorIds.filter(id => !foundIds.includes(id));
                throw new NotFoundError_1.NotFoundError(`Some vendor IDs were not found, not vendors, or not eligible: ${missing.join(', ')}`);
            }
        }
        else {
            targetVendors = await prisma_1.default.user.findMany({
                where: {
                    role: client_1.Role.VENDOR,
                    isVerified: true,
                    isSuspended: false,
                    isDeleted: false
                },
                select: { id: true, email: true, fullName: true, creditPoints: true }
            });
            if (targetVendors.length === 0) {
                throw new NotFoundError_1.NotFoundError("No eligible vendors found to receive credit points");
            }
        }
        const expiryDate = expiresAt ? new Date(expiresAt) : null;
        if (expiryDate && isNaN(expiryDate.getTime())) {
            throw new BadRequestError_1.BadRequestError("Invalid expiresAt date format");
        }
        const grantId = `GRANT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const results = await prisma_1.default.$transaction(async (tx) => {
            const createdTransactions = [];
            for (const vendor of targetVendors) {
                const balanceBefore = vendor.creditPoints;
                const balanceAfter = balanceBefore + points;
                await tx.user.update({
                    where: { id: vendor.id },
                    data: {
                        creditPoints: balanceAfter,
                        creditPointsPurchased: { increment: points }
                    }
                });
                const transaction = await tx.creditTransaction.create({
                    data: {
                        transactionNumber: this.generateTransactionNumber(),
                        userId: vendor.id,
                        type: client_1.CreditTransactionType.ADMIN_ADJUSTMENT,
                        status: client_1.CreditTransactionStatus.COMPLETED,
                        points,
                        balanceBefore,
                        balanceAfter,
                        description: `Admin credit grant: ${name}${reason ? ` — ${reason}` : ''}`,
                        metadata: {
                            grantId,
                            grantName: name,
                            grantedBy: admin.id,
                            grantedByName: admin.fullName,
                            reason: reason || null
                        },
                        expiresAt: expiryDate
                    }
                });
                createdTransactions.push({
                    transactionId: transaction.id,
                    vendorId: vendor.id,
                    vendorEmail: vendor.email,
                    vendorName: vendor.fullName,
                    points,
                    balanceBefore,
                    balanceAfter
                });
            }
            return createdTransactions;
        });
        // Logger.info(
        //   `Admin ${admin.email} gifted ${points} points to ${targetVendors.length} vendor(s). Grant: ${grantId}`
        // );
        return {
            grantId,
            name,
            points,
            expiresAt: expiryDate,
            vendorCount: targetVendors.length,
            transactions: results
        };
    }
}
exports.CreditPointService = CreditPointService;
