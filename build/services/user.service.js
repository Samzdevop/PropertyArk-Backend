"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const argon2_1 = require("argon2");
const BadRequestError_1 = require("../errors/BadRequestError");
const UnauthorizedError_1 = require("../errors/UnauthorizedError");
const logger_1 = __importDefault(require("../config/logger"));
const NotFoundError_1 = require("../errors/NotFoundError");
const client_1 = require("@prisma/client");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
class UserService {
    static async changePassword(userId, currentPassword, newPassword) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                password: true,
                email: true,
                fullName: true,
            },
        });
        if (!user) {
            throw new BadRequestError_1.BadRequestError("User not found");
        }
        if (!user.password) {
            throw new BadRequestError_1.BadRequestError("This account uses Google login. Please use Google to sign in or set a password first.");
        }
        const isPasswordValid = await (0, argon2_1.verify)(user.password, currentPassword);
        if (!isPasswordValid) {
            throw new UnauthorizedError_1.UnauthorizedError("Current password is incorrect");
        }
        const hashedNewPassword = await (0, argon2_1.hash)(newPassword);
        await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                password: hashedNewPassword,
            },
        });
        logger_1.default.info(`Password changed successfully for user: ${user.email}`);
    }
    static async getUserDashboardStats(userId) {
        const user = await prisma_1.default.user.findUnique({
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
            throw new NotFoundError_1.NotFoundError("User not found");
        }
        const savedProperties = await prisma_1.default.favorite.count({
            where: { userId }
        });
        const activeInquiries = await prisma_1.default.inquiry.count({
            where: {
                userId,
                status: client_1.InquiryStatus.PENDING
            }
        });
        // Get occupied properties (RENTED status)
        // Since we don't have a Lease model yet, we check if user has properties with RENTED status
        // This would need a purchase/rental tracking model
        // For now, we'll use a placeholder
        const occupiedProperties = await prisma_1.default.property.count({
            where: {
                status: client_1.PropertyStatus.RENTED,
                // would need to implement a relation to track who rented it
                // For now, we'll count properties marked as RENTED
                // I might want to add a Purchase or Rental model
            }
        });
        const boughtProperties = await prisma_1.default.property.count({
            where: {
                status: client_1.PropertyStatus.SOLD
            }
        });
        const recommendedProperties = await this.getRecommendedProperties(user);
        const recentInquiries = await prisma_1.default.inquiry.findMany({
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
        const recentFavorites = await prisma_1.default.favorite.findMany({
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
            recommendedProperties: recommendedProperties.map((p) => ({
                ...p,
                priceDisplay: this.getPriceDisplay(p)
            })),
            recentInquiries: recentInquiries.map((i) => ({
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
            recentFavorites: recentFavorites.map((f) => ({
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
    static async getRecommendedProperties(user) {
        const limit = 10;
        const where = {
            listingStatus: client_1.PropertyListingStatus.ACTIVE,
            status: client_1.PropertyStatus.AVAILABLE
        };
        if (user.city && user.state) {
            where.OR = [
                { city: { contains: user.city, mode: 'insensitive' } },
                { state: { contains: user.state, mode: 'insensitive' } },
                { country: { contains: user.country || 'USA', mode: 'insensitive' } }
            ];
        }
        else if (user.location) {
            const locationParts = user.location.split(',').map((part) => part.trim());
            where.OR = [
                { city: { contains: locationParts[0] || '', mode: 'insensitive' } },
                { state: { contains: locationParts[1] || '', mode: 'insensitive' } },
                { country: { contains: locationParts[2] || 'USA', mode: 'insensitive' } }
            ];
        }
        let properties = await prisma_1.default.property.findMany({
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
            properties = await prisma_1.default.property.findMany({
                where: {
                    listingStatus: client_1.PropertyListingStatus.ACTIVE,
                    status: client_1.PropertyStatus.AVAILABLE
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
    static getPriceDisplay(property) {
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
    static async getUserInquiriesStats(userId) {
        const [total, pending, accepted, declined, completed] = await Promise.all([
            prisma_1.default.inquiry.count({ where: { userId } }),
            prisma_1.default.inquiry.count({
                where: {
                    userId,
                    status: client_1.InquiryStatus.PENDING
                }
            }),
            prisma_1.default.inquiry.count({
                where: {
                    userId,
                    status: client_1.InquiryStatus.ACCEPTED
                }
            }),
            prisma_1.default.inquiry.count({
                where: {
                    userId,
                    status: client_1.InquiryStatus.DECLINED
                }
            }),
            prisma_1.default.inquiry.count({
                where: {
                    userId,
                    isCompleted: true
                }
            })
        ]);
        const upcoming = await prisma_1.default.inquiry.count({
            where: {
                userId,
                status: client_1.InquiryStatus.ACCEPTED,
                scheduledDate: { gte: new Date() },
                isCompleted: false
            }
        });
        const recentInquiries = await prisma_1.default.inquiry.findMany({
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
            recentInquiries: recentInquiries.map((i) => ({
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
    static async completeInquiry(inquiryId, userId, data) {
        const { satisfactionStatus, satisfactionComment } = data;
        const inquiry = await prisma_1.default.inquiry.findUnique({
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
                },
                vendor: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                }
            }
        });
        if (!inquiry) {
            throw new NotFoundError_1.NotFoundError("Inquiry not found");
        }
        if (inquiry.userId !== userId) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to complete this inquiry");
        }
        if (inquiry.status !== client_1.InquiryStatus.ACCEPTED) {
            throw new BadRequestError_1.BadRequestError("Only accepted inquiries can be marked as completed");
        }
        if (inquiry.isCompleted) {
            throw new BadRequestError_1.BadRequestError("Inquiry is already marked as completed");
        }
        if (!satisfactionStatus || !['SATISFIED', 'NOT_SATISFIED', 'OTHERS'].includes(satisfactionStatus)) {
            throw new BadRequestError_1.BadRequestError("Satisfaction status is required. Must be: SATISFIED, NOT_SATISFIED, or OTHERS");
        }
        if (satisfactionStatus === 'OTHERS' && !satisfactionComment) {
            throw new BadRequestError_1.BadRequestError("Comment is required when satisfaction status is OTHERS");
        }
        const updatedInquiry = await prisma_1.default.inquiry.update({
            where: { id: inquiryId },
            data: {
                isCompleted: true,
                completedAt: new Date(),
                satisfactionStatus: satisfactionStatus,
                satisfactionComment: satisfactionComment || null
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
        await this.sendCompletionNotification(updatedInquiry);
        logger_1.default.info(`Inquiry ${inquiry.inquiryNumber} completed by user ${userId}`);
        return updatedInquiry;
    }
    static async sendCompletionNotification(inquiry) {
        try {
            const statusMap = {
                SATISFIED: 'Satisfied 😊',
                NOT_SATISFIED: 'Not Satisfied 😞',
                OTHERS: 'Others'
            };
            await prisma_1.default.notification.create({
                data: {
                    userId: inquiry.vendorId,
                    type: 'GENERAL',
                    title: 'Inquiry Completed',
                    message: `${inquiry.user.fullName} has completed their inquiry for "${inquiry.property.name}". Satisfaction: ${statusMap[inquiry.satisfactionStatus]}`,
                    data: {
                        inquiryId: inquiry.id,
                        inquiryNumber: inquiry.inquiryNumber,
                        propertyId: inquiry.propertyId,
                        satisfactionStatus: inquiry.satisfactionStatus,
                        satisfactionComment: inquiry.satisfactionComment
                    }
                }
            });
            if (inquiry.vendor.email) {
                const emailHtml = await (0, mailTemplate_1.render)('inquiry-completed', {
                    vendorName: inquiry.vendor.fullName,
                    inquiryNumber: inquiry.inquiryNumber,
                    propertyName: inquiry.property.name,
                    userName: inquiry.user.fullName,
                    satisfactionStatus: inquiry.satisfactionStatus,
                    satisfactionComment: inquiry.satisfactionComment || 'No additional comment',
                    currentYear: new Date().getFullYear(),
                    dashboardUrl: `${process.env.FRONTEND_URL}/vendor/inquiries`
                });
                const mailOptions = {
                    to: inquiry.vendor.email,
                    from: `"Property Ark" ${process.env.SENDER_EMAIL}`,
                    subject: `Inquiry Completed: ${inquiry.inquiryNumber}`,
                    text: `User ${inquiry.user.fullName} has completed their inquiry.`,
                    html: emailHtml
                };
                await (0, mail_services_1.sendGraphMail)(mailOptions);
                logger_1.default.info(`Inquiry completion email sent to vendor ${inquiry.vendor.email}`);
            }
        }
        catch (error) {
            logger_1.default.error('Failed to send completion notification:', error);
        }
    }
    static async selfDeleteAccount(userId, data) {
        const { password, reason, confirmationPhrase } = data;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                password: true,
                googleId: true,
                isDeleted: true,
                creditPoints: true,
            },
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError("User not found");
        }
        if (user.isDeleted) {
            throw new BadRequestError_1.BadRequestError("Account is already deleted");
        }
        if (user.role === client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Admin accounts cannot be self-deleted. Please contact support.");
        }
        // ✅ Confirmation phrase check (safety mechanism)
        const requiredPhrase = "DELETE MY ACCOUNT";
        if (confirmationPhrase !== requiredPhrase) {
            throw new BadRequestError_1.BadRequestError(`Please type "${requiredPhrase}" exactly to confirm account deletion`);
        }
        // ✅ Password verification (for password-based accounts)
        if (user.password && !user.googleId) {
            if (!password) {
                throw new BadRequestError_1.BadRequestError("Password is required to delete your account");
            }
            const isPasswordValid = await (0, argon2_1.verify)(user.password, password);
            if (!isPasswordValid) {
                throw new UnauthorizedError_1.UnauthorizedError("Incorrect password");
            }
        }
        const blockingConditions = await this.checkDeletionBlockers(userId, user.role);
        if (blockingConditions.length > 0) {
            throw new BadRequestError_1.BadRequestError(`Cannot delete account. Please resolve the following first: ${blockingConditions.join(", ")}`);
        }
        const deletedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                isDeleted: true,
                isSuspended: true,
                isVerified: false,
                deletedAt: new Date(),
                deletedBy: userId, // "self"
                deletionReason: reason || "User requested account deletion",
                email: `${user.email}`,
                fullName: `${user.fullName}`,
                phone: null,
                avatar: null,
                location: null,
                googleId: null,
                password: null,
                ninPhotoUrl: null,
                ninRejectionReason: null,
                passwordResetToken: null,
                passwordResetExpiresAt: null,
                verificationCode: null,
                verificationExpires: null,
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isDeleted: true,
                deletedAt: true,
            },
        });
        logger_1.default.info(`User ${user.email} (${user.id}) self-deleted their account`);
        return {
            user: deletedUser,
            originalEmail: user.email,
            creditPointsLost: user.creditPoints,
        };
    }
    static async checkDeletionBlockers(userId, role) {
        const blockers = [];
        if (role === client_1.Role.VENDOR) {
            const activeProperties = await prisma_1.default.property.count({
                where: {
                    vendorId: userId,
                    listingStatus: "ACTIVE",
                },
            });
            if (activeProperties > 0) {
                blockers.push(`${activeProperties} active property listing(s). Please remove or deactivate them first`);
            }
            const pendingBookings = await prisma_1.default.shortletBooking.count({
                where: {
                    vendorId: userId,
                    status: {
                        in: ["PENDING", "APPROVED", "CHECKED_IN"],
                    },
                },
            });
            if (pendingBookings > 0) {
                blockers.push(`${pendingBookings} active booking(s). Please resolve them first`);
            }
        }
        if (role === client_1.Role.USER) {
            const pendingInquiries = await prisma_1.default.inquiry.count({
                where: {
                    userId,
                    status: "PENDING",
                },
            });
            if (pendingInquiries > 0) {
                blockers.push(`${pendingInquiries} pending inquiry(ies). Please wait for them to be resolved`);
            }
        }
        const openSupportChats = await prisma_1.default.chatRequest.count({
            where: {
                userId,
                status: {
                    in: ["PENDING", "ASSIGNED"],
                },
            },
        });
        if (openSupportChats > 0) {
            blockers.push(`${openSupportChats} open support request(s). Please wait for resolution`);
        }
        return blockers;
    }
    static async validateRoleSwitch(userId, targetRole) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isDeleted: true,
                isSuspended: true,
                ninVerificationStatus: true,
                creditPoints: true,
            },
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError("User not found");
        }
        if (user.isDeleted) {
            throw new BadRequestError_1.BadRequestError("Deleted accounts cannot switch roles");
        }
        if (user.isSuspended) {
            throw new ForbiddenError_1.ForbiddenError("Suspended accounts cannot switch roles");
        }
        if (user.role !== client_1.Role.USER && user.role !== client_1.Role.VENDOR) {
            throw new ForbiddenError_1.ForbiddenError("Only users and vendors can switch roles. Admins and staff cannot.");
        }
        if (!['USER', 'VENDOR'].includes(targetRole)) {
            throw new BadRequestError_1.BadRequestError("Target role must be either USER or VENDOR");
        }
        if (user.role === targetRole) {
            throw new BadRequestError_1.BadRequestError(`You are already a ${targetRole.toLowerCase()}`);
        }
        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            ninVerificationStatus: user.ninVerificationStatus,
            creditPoints: user.creditPoints,
        };
    }
}
exports.UserService = UserService;
