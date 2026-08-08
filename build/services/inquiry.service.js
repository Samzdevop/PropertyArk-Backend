"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InquiryService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const BadRequestError_1 = require("../errors/BadRequestError");
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../config/logger"));
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
const vendor_service_1 = require("./vendor.service");
class InquiryService {
    static generateInquiryNumber() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `INQ-${year}-${random}`;
    }
    static async createInquiry(userId, data) {
        const { propertyId, name, location, message, meetingType, proposedDate } = data;
        const property = await prisma_1.default.property.findUnique({
            where: {
                id: propertyId,
                listingStatus: client_1.PropertyListingStatus.ACTIVE
            },
            include: {
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
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found or not available");
        }
        if (!property.vendor) {
            throw new BadRequestError_1.BadRequestError("Property has no vendor associated");
        }
        const inquiryData = {
            inquiryNumber: this.generateInquiryNumber(),
            userId,
            propertyId,
            vendorId: property.vendorId,
            name,
            location,
            message,
            meetingType,
            status: client_1.InquiryStatus.PENDING
        };
        if (proposedDate) {
            const proposedDateTime = new Date(proposedDate);
            if (isNaN(proposedDateTime.getTime())) {
                throw new BadRequestError_1.BadRequestError("Invalid proposed date format");
            }
            if (proposedDateTime < new Date()) {
                throw new BadRequestError_1.BadRequestError("Proposed date must be in the future");
            }
            const isAvailable = await vendor_service_1.VendorService.isAvailable(property.vendorId, proposedDateTime);
            // if (!isAvailable) {
            //   throw new BadRequestError("Vendor is not available at the proposed date and time");
            // }
            if (!isAvailable) {
                inquiryData.proposedDate = proposedDateTime;
            }
            else {
                inquiryData.proposedDate = proposedDateTime;
            }
        }
        const inquiry = await prisma_1.default.inquiry.create({
            data: inquiryData,
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        avatar: true
                    }
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        state: true,
                        listingType: true
                    }
                }
            }
        });
        // Increment inquiry count on property
        await prisma_1.default.property.update({
            where: { id: propertyId },
            data: { inquiryCount: { increment: 1 } }
        });
        await this.sendInquiryNotifications(inquiry, property);
        logger_1.default.info(`Inquiry ${inquiry.inquiryNumber} created by user ${userId} for property ${propertyId}`);
        return inquiry;
    }
    static async sendInquiryNotifications(inquiry, property) {
        try {
            await prisma_1.default.notification.create({
                data: {
                    userId: property.vendorId,
                    type: 'GENERAL',
                    title: 'New Property Inquiry',
                    message: `${inquiry.name} has inquired about your property "${property.name}"`,
                    data: {
                        inquiryId: inquiry.id,
                        propertyId: property.id,
                        inquiryNumber: inquiry.inquiryNumber,
                        meetingType: inquiry.meetingType
                    }
                }
            });
            // Send email notification to vendor
            if (property.vendor.email) {
                const emailHtml = await (0, mailTemplate_1.render)('inquiry-notification', {
                    vendorName: property.vendor.fullName,
                    inquiryName: inquiry.name,
                    inquiryLocation: inquiry.location,
                    inquiryMessage: inquiry.message,
                    inquiryNumber: inquiry.inquiryNumber,
                    meetingType: inquiry.meetingType,
                    propertyName: property.name,
                    propertyAddress: property.address,
                    propertyCity: property.city,
                    inquiryDate: new Date().toLocaleString(),
                    dashboardUrl: `${process.env.FRONTEND_URL}/vendor/inquiries`,
                    currentYear: new Date().getFullYear()
                });
                const mailOptions = {
                    to: property.vendor.email,
                    from: `"Property Management" ${process.env.SENDER_EMAIL}`,
                    subject: `New Inquiry: ${inquiry.inquiryNumber} - ${property.name}`,
                    text: `You have a new inquiry from ${inquiry.name} about ${property.name}`,
                    html: emailHtml
                };
                await (0, mail_services_1.sendGraphMail)(mailOptions);
                logger_1.default.info(`Inquiry notification email sent to vendor ${property.vendor.email}`);
            }
            // Send confirmation email to inquirer
            if (inquiry.user.email) {
                const emailHtml = await (0, mailTemplate_1.render)('inquiry-confirmation', {
                    userName: inquiry.user.fullName,
                    inquiryName: inquiry.name,
                    inquiryNumber: inquiry.inquiryNumber,
                    propertyName: property.name,
                    propertyAddress: property.address,
                    propertyCity: property.state,
                    meetingType: inquiry.meetingType,
                    inquiryDate: new Date().toLocaleString(),
                    currentYear: new Date().getFullYear()
                });
                const mailOptions = {
                    to: inquiry.user.email,
                    from: `"Property Management" ${process.env.SENDER_EMAIL}`,
                    subject: `Inquiry Confirmation: ${inquiry.inquiryNumber}`,
                    text: `Your inquiry about ${property.name} has been sent successfully.`,
                    html: emailHtml
                };
                await (0, mail_services_1.sendGraphMail)(mailOptions);
                logger_1.default.info(`Inquiry confirmation email sent to ${inquiry.user.email}`);
            }
        }
        catch (error) {
            logger_1.default.error('Failed to send inquiry notifications:', error);
        }
    }
    static async getVendorInquiries(vendorId, filters) {
        const { status, propertyId, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;
        const take = limit;
        const where = { vendorId };
        if (status) {
            where.status = status;
        }
        if (propertyId) {
            where.propertyId = propertyId;
        }
        const [inquiries, total, counts] = await Promise.all([
            prisma_1.default.inquiry.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                            avatar: true
                        }
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                            address: true,
                            city: true,
                            state: true,
                            listingType: true,
                            media: {
                                take: 1,
                                where: { isPrimary: true },
                                select: { url: true }
                            }
                        }
                    }
                }
            }),
            prisma_1.default.inquiry.count({ where }),
            prisma_1.default.inquiry.groupBy({
                by: ['status'],
                where: { vendorId },
                _count: true
            })
        ]);
        const statusCounts = counts.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
        }, {});
        return {
            inquiries,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            counts: {
                pending: statusCounts.PENDING || 0,
                accepted: statusCounts.ACCEPTED || 0,
                declined: statusCounts.DECLINED || 0,
                total
            }
        };
    }
    static async getUserInquiries(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const take = limit;
        const [inquiries, total] = await Promise.all([
            prisma_1.default.inquiry.findMany({
                where: { userId },
                skip,
                take,
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
                            }
                        }
                    }
                }
            }),
            prisma_1.default.inquiry.count({ where: { userId } })
        ]);
        return {
            inquiries,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    static async getInquiryById(inquiryId, userId, role) {
        const inquiry = await prisma_1.default.inquiry.findUnique({
            where: { id: inquiryId },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        avatar: true
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
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        state: true,
                        listingType: true,
                        media: {
                            take: 1,
                            where: { isPrimary: true },
                            select: { url: true }
                        }
                    }
                }
            }
        });
        if (!inquiry) {
            throw new NotFoundError_1.NotFoundError("Inquiry not found");
        }
        const isUser = inquiry.userId === userId;
        const isVendor = inquiry.vendorId === userId;
        const isAdmin = role === client_1.Role.ADMIN;
        if (!isUser && !isVendor && !isAdmin) {
            throw new ForbiddenError_1.ForbiddenError("You don't have access to this inquiry");
        }
        if (isVendor && !inquiry.viewedAt) {
            await prisma_1.default.inquiry.update({
                where: { id: inquiryId },
                data: { viewedAt: new Date() }
            });
            inquiry.viewedAt = new Date();
        }
        return inquiry;
    }
    static async reviewInquiry(inquiryId, vendorId, data) {
        const { status, reason, scheduledDate } = data;
        const inquiry = await prisma_1.default.inquiry.findUnique({
            where: { id: inquiryId },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        vendorId: true,
                        vendor: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
        if (!inquiry) {
            throw new NotFoundError_1.NotFoundError("Inquiry not found");
        }
        if (inquiry.vendorId !== vendorId) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to review this inquiry");
        }
        if (inquiry.status !== client_1.InquiryStatus.PENDING) {
            throw new BadRequestError_1.BadRequestError(`Inquiry is already ${inquiry.status.toLowerCase()}`);
        }
        if (status === 'DECLINED' && !reason) {
            throw new BadRequestError_1.BadRequestError("Reason is required when declining an inquiry");
        }
        const updateData = {
            status: status,
            respondedAt: new Date()
        };
        if (status === 'DECLINED') {
            updateData.responseNote = reason;
        }
        if (status === 'ACCEPTED') {
            if (!scheduledDate) {
                throw new BadRequestError_1.BadRequestError("Scheduled date is required when accepting an inquiry");
            }
            const scheduledDateTime = new Date(scheduledDate);
            if (isNaN(scheduledDateTime.getTime())) {
                throw new BadRequestError_1.BadRequestError("Invalid scheduled date format");
            }
            // Validate scheduled date is in the future
            if (scheduledDateTime < new Date()) {
                throw new BadRequestError_1.BadRequestError("Scheduled date must be in the future");
            }
            // Check vendor availability
            const isAvailable = await vendor_service_1.VendorService.isAvailable(vendorId, scheduledDateTime);
            //  if (!isAvailable) {
            //   throw new BadRequestError("You are not available at the scheduled date and time. Please set your availability first.");
            // }
            // updateData.scheduledDate = scheduledDateTime;
            if (!isAvailable) {
                updateData.scheduledDate = scheduledDateTime;
                if (!updateData.responseNote) {
                    updateData.responseNote = "Scheduled outside of regular availability hours";
                }
            }
            else {
                updateData.scheduledDate = scheduledDateTime;
            }
        }
        const updatedInquiry = await prisma_1.default.inquiry.update({
            where: { id: inquiryId },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true
                    }
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            }
        });
        await this.sendReviewNotification(updatedInquiry, status, reason);
        logger_1.default.info(`Inquiry ${inquiry.inquiryNumber} ${status.toLowerCase()} by vendor ${vendorId}`);
        return updatedInquiry;
    }
    static async sendReviewNotification(inquiry, status, reason, scheduledDate) {
        try {
            const isAccepted = status === 'ACCEPTED';
            let message = isAccepted
                ? `Your inquiry about "${inquiry.property.name}" has been accepted`
                : `Your inquiry about "${inquiry.property.name}" has been declined${reason ? `: ${reason}` : ''}`;
            if (isAccepted && scheduledDate) {
                const date = new Date(scheduledDate);
                message += ` for ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
            }
            await prisma_1.default.notification.create({
                data: {
                    userId: inquiry.userId,
                    type: 'GENERAL',
                    title: isAccepted ? 'Inquiry Accepted' : 'Inquiry Declined',
                    message: isAccepted
                        ? `Your inquiry about "${inquiry.property.name}" has been accepted`
                        : `Your inquiry about "${inquiry.property.name}" has been declined${reason ? `: ${reason}` : ''}`,
                    data: {
                        inquiryId: inquiry.id,
                        propertyId: inquiry.property.id,
                        inquiryNumber: inquiry.inquiryNumber,
                        status,
                        ...(reason && { reason }),
                        ...(scheduledDate && { scheduledDate })
                    }
                }
            });
            if (inquiry.user.email) {
                const templateName = isAccepted ? 'inquiry-accepted' : 'inquiry-declined';
                const subject = isAccepted
                    ? `Inquiry Accepted: ${inquiry.inquiryNumber}`
                    : `Inquiry Declined: ${inquiry.inquiryNumber}`;
                const emailHtml = await (0, mailTemplate_1.render)(templateName, {
                    userName: inquiry.user.fullName,
                    inquiryNumber: inquiry.inquiryNumber,
                    propertyName: inquiry.property.name,
                    status: status,
                    ...(reason && { reason }),
                    ...(scheduledDate && {
                        scheduledDate: new Date(scheduledDate).toLocaleString()
                    }),
                    currentYear: new Date().getFullYear(),
                    dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
                });
                const mailOptions = {
                    to: inquiry.user.email,
                    from: `"Property Management" ${process.env.SENDER_EMAIL}`,
                    subject,
                    text: `Your inquiry ${inquiry.inquiryNumber} has been ${status.toLowerCase()}`,
                    html: emailHtml
                };
                await (0, mail_services_1.sendGraphMail)(mailOptions);
                logger_1.default.info(`Inquiry review email sent to ${inquiry.user.email}`);
            }
        }
        catch (error) {
            logger_1.default.error('Failed to send inquiry review notification:', error);
        }
    }
    static async getInquiryStats(vendorId) {
        const [total, pending, accepted, declined, byProperty] = await Promise.all([
            prisma_1.default.inquiry.count({ where: { vendorId } }),
            prisma_1.default.inquiry.count({ where: { vendorId, status: client_1.InquiryStatus.PENDING } }),
            prisma_1.default.inquiry.count({ where: { vendorId, status: client_1.InquiryStatus.ACCEPTED } }),
            prisma_1.default.inquiry.count({ where: { vendorId, status: client_1.InquiryStatus.DECLINED } }),
            prisma_1.default.inquiry.groupBy({
                by: ['propertyId'],
                where: { vendorId },
                _count: true,
                orderBy: { _count: { propertyId: 'desc' } },
                take: 10
            })
        ]);
        const propertyIds = byProperty.map(item => item.propertyId);
        let propertyMap = new Map();
        if (propertyIds.length > 0) {
            const properties = await prisma_1.default.property.findMany({
                where: { id: { in: propertyIds } },
                select: { id: true, name: true }
            });
            propertyMap = new Map(properties.map(p => [p.id, p]));
        }
        return {
            total,
            pending,
            accepted,
            declined,
            byProperty: byProperty.map((item) => ({
                propertyId: item.propertyId,
                propertyName: propertyMap.get(item.propertyId)?.name || 'Unknown Property',
                count: item._count
            }))
        };
    }
}
exports.InquiryService = InquiryService;
