"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfessionalServiceService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const BadRequestError_1 = require("../errors/BadRequestError");
const NotFoundError_1 = require("../errors/NotFoundError");
const logger_1 = __importDefault(require("../config/logger"));
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
// import { MailInterface } from "../interfaces/mail.interfaces";
const upload_1 = require("../config/upload");
// import { MediaType } from "@prisma/client";
class ProfessionalServiceService {
    static generateRequestNumber() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `PSR-${year}-${random}`;
    }
    static async getAdminEmails() {
        const admins = await prisma_1.default.user.findMany({
            where: {
                role: client_1.Role.ADMIN,
                isVerified: true,
                isSuspended: false,
                isDeleted: false,
                email: { not: '' },
            },
            select: { email: true },
        });
        const emails = admins.map(a => a.email);
        if (emails.length === 0) {
            logger_1.default.warn('No admin emails found in database');
        }
        return emails;
    }
    static async createRequest(userId, data, files) {
        const { fullName, email, phone, serviceType, consultationDate, propertyReference, message } = data;
        const consultDate = new Date(consultationDate);
        if (isNaN(consultDate.getTime())) {
            throw new BadRequestError_1.BadRequestError("Invalid consultation date format");
        }
        if (consultDate < new Date()) {
            throw new BadRequestError_1.BadRequestError("Consultation date must be in the future");
        }
        const request = await prisma_1.default.professionalService.create({
            data: {
                requestNumber: this.generateRequestNumber(),
                userId: userId || null,
                fullName,
                email,
                phone: phone || null,
                serviceType,
                consultationDate: consultDate,
                propertyReference: propertyReference || null,
                message,
                status: client_1.ContactStatus.UNREAD
            }
        });
        if (files && files.length > 0) {
            await this.uploadDocuments(request.id, files);
        }
        await this.sendNotifications(request, files?.length || 0);
        logger_1.default.info(`Professional service request ${request.requestNumber} created by ${email}`);
        return this.getRequestById(request.id, userId, 'USER');
    }
    static async uploadDocuments(requestId, files) {
        try {
            const storageDriver = process.env.STORAGE_DRIVER || 'local';
            const container = 'professional-service-documents';
            const documentsData = [];
            for (const file of files) {
                let url;
                let key;
                // if (storageDriver === 'azure') {
                //   const urls = await uploadMultipleToAzure([file], container);
                //   url = urls[0];
                //   key = url.split('/').pop() || file.originalname;
                // } else if (storageDriver === 's3') {
                //   url = (file as any).location || `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${(file as any).key}`;
                //   key = (file as any).key || file.originalname;
                // } else {
                //   url = `/uploads/${file.filename}`;
                //   key = file.filename;
                // }
                if (storageDriver === 'azure') {
                    const urls = await (0, upload_1.uploadMultipleToAzure)([file], container);
                    url = urls[0];
                    key = url.split('/').pop() || file.originalname;
                }
                else if (storageDriver === 's3') {
                    const s3File = file;
                    url = s3File.location || `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3File.key}`;
                    key = s3File.key || file.originalname;
                }
                else {
                    url = `/uploads/${file.filename}`;
                    key = file.filename;
                }
                documentsData.push({
                    name: file.originalname,
                    type: 'OTHER',
                    url,
                    key,
                    size: file.size,
                    mimeType: file.mimetype,
                    container,
                    uploadedById: (await prisma_1.default.professionalService.findUnique({
                        where: { id: requestId },
                        select: { userId: true, email: true }
                    }))?.userId || 'system',
                    professionalServiceId: requestId
                });
            }
            if (documentsData.length > 0) {
                await prisma_1.default.document.createMany({ data: documentsData });
            }
        }
        catch (error) {
            logger_1.default.error('Failed to upload documents:', error);
        }
    }
    static async sendNotifications(request, documentCount) {
        try {
            const adminEmails = await this.getAdminEmails();
            //   if (adminEmails.length === 0) {
            //     Logger.warn('No admins found to notify about professional service request');
            //   } else {
            const adminEmailHtml = await (0, mailTemplate_1.render)('professional-service-admin', {
                requestNumber: request.requestNumber,
                fullName: request.fullName,
                email: request.email,
                phone: request.phone || 'Not provided',
                serviceType: request.serviceType,
                consultationDate: new Date(request.consultationDate).toLocaleString(),
                propertyReference: request.propertyReference || 'Not provided',
                message: request.message,
                documentCount,
                submittedAt: new Date().toLocaleString(),
                currentYear: new Date().getFullYear(),
                // dashboardUrl: `${process.env.FRONTEND_URL}/admin/professional-services`,
            });
            const adminEmailPromises = adminEmails.map(adminEmail => (0, mail_services_1.sendGraphMail)({
                to: adminEmails || process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL,
                from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
                subject: `New Professional Service Request: ${request.requestNumber}`,
                text: `New request from ${request.fullName}`,
                html: adminEmailHtml,
            }).catch(error => {
                logger_1.default.error(`Failed to send to admin ${adminEmail}:`, error);
            }));
            await Promise.all(adminEmailPromises);
            logger_1.default.info(`Admin notifications sent to ${adminEmails.length} admin(s)`);
            const userEmailHtml = await (0, mailTemplate_1.render)('professional-service-confirmation', {
                fullName: request.fullName,
                requestNumber: request.requestNumber,
                serviceType: request.serviceType,
                consultationDate: new Date(request.consultationDate).toLocaleString(),
                currentYear: new Date().getFullYear(),
            });
            await (0, mail_services_1.sendGraphMail)({
                to: request.email,
                from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
                subject: `We've received your request: ${request.requestNumber}`,
                text: `Your request has been received`,
                html: userEmailHtml,
            });
            logger_1.default.info(`Professional service notifications sent for ${request.requestNumber}`);
        }
        catch (error) {
            logger_1.default.error('Failed to send professional service notifications:', error);
        }
    }
    static async getAllRequests(filters) {
        const { status, serviceType, page = 1, limit = 20, search } = filters;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (serviceType)
            where.serviceType = serviceType;
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { requestNumber: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [requests, total, counts] = await Promise.all([
            prisma_1.default.professionalService.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    documents: {
                        select: {
                            id: true,
                            name: true,
                            url: true,
                            size: true,
                            mimeType: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            }),
            prisma_1.default.professionalService.count({ where }),
            prisma_1.default.professionalService.groupBy({
                by: ['status'],
                _count: true,
            }),
        ]);
        const statusCounts = counts.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
        }, {});
        return {
            requests,
            counts: {
                total,
                unread: statusCounts.UNREAD || 0,
                read: statusCounts.READ || 0,
                replied: statusCounts.REPLIED || 0,
                archived: statusCounts.ARCHIVED || 0,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    static async getRequestById(requestId, userId, role) {
        const request = await prisma_1.default.professionalService.findUnique({
            where: { id: requestId },
            include: {
                documents: true,
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });
        if (!request) {
            throw new NotFoundError_1.NotFoundError("Professional service request not found");
        }
        const isAdmin = role === client_1.Role.ADMIN;
        const isOwner = userId && request.userId === userId;
        if (!isAdmin && !isOwner) {
            throw new NotFoundError_1.NotFoundError("Request not found");
        }
        if (isAdmin && request.status === client_1.ContactStatus.UNREAD) {
            await prisma_1.default.professionalService.update({
                where: { id: requestId },
                data: { status: client_1.ContactStatus.READ },
            });
            request.status = client_1.ContactStatus.READ;
        }
        return request;
    }
    static async deleteRequest(requestId, adminId) {
        const request = await prisma_1.default.professionalService.findUnique({
            where: { id: requestId },
            include: { documents: true },
        });
        if (!request) {
            throw new NotFoundError_1.NotFoundError("Professional service request not found");
        }
        // Delete in transaction
        await prisma_1.default.$transaction(async (tx) => {
            await tx.document.deleteMany({
                where: { professionalServiceId: requestId },
            });
            await tx.professionalService.delete({
                where: { id: requestId },
            });
        });
        logger_1.default.info(`Professional service request ${request.requestNumber} deleted by admin ${adminId}`);
    }
}
exports.ProfessionalServiceService = ProfessionalServiceService;
