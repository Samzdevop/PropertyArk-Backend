"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const NotFoundError_1 = require("../errors/NotFoundError");
const logger_1 = __importDefault(require("../config/logger"));
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
class ContactService {
    static generateContactNumber() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `CNT-${year}-${random}`;
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
        return admins.map(a => a.email);
    }
    static async createContact(data) {
        const contact = await prisma_1.default.contact.create({
            data: {
                contactNumber: this.generateContactNumber(),
                fullName: data.fullName,
                email: data.email,
                subject: data.subject,
                message: data.message,
                status: client_1.ContactStatus.UNREAD,
            },
        });
        await this.sendNotifications(contact);
        logger_1.default.info(`Contact message ${contact.contactNumber} created by ${data.email}`);
        return contact;
    }
    static async sendNotifications(contact) {
        try {
            const adminEmails = await this.getAdminEmails();
            // if (adminEmails.length === 0) {
            //     Logger.warn('No admins found to notify about contact message');
            // } else {
            const adminHtml = await (0, mailTemplate_1.render)('contact-us-admin', {
                contactNumber: contact.contactNumber,
                fullName: contact.fullName,
                email: contact.email,
                subject: contact.subject,
                message: contact.message,
                submittedAt: new Date().toLocaleString(),
                currentYear: new Date().getFullYear(),
                // dashboardUrl: `${process.env.FRONTEND_URL}/admin/contacts`
            });
            const adminEmailPromises = adminEmails.map(adminEmail => (0, mail_services_1.sendGraphMail)({
                to: adminEmails || process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL,
                from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
                subject: `New Contact: ${contact.subject}`,
                text: `New contact message from ${contact.fullName}`,
                html: adminHtml,
            }).catch(error => {
                logger_1.default.error(`Failed to send contact notification to ${adminEmail}:`, error);
            }));
            await Promise.all(adminEmailPromises);
            logger_1.default.info(`Admin notifications sent to ${adminEmails.length} admin(s)`);
            const userHtml = await (0, mailTemplate_1.render)('contact-us-confirmation', {
                fullName: contact.fullName,
                contactNumber: contact.contactNumber,
                subject: contact.subject,
                message: contact.message,
                currentYear: new Date().getFullYear(),
            });
            await (0, mail_services_1.sendGraphMail)({
                to: contact.email,
                from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
                subject: `We've received your message: ${contact.contactNumber}`,
                text: `Your message has been received`,
                html: userHtml,
            });
            logger_1.default.info(`Contact notifications sent for ${contact.contactNumber}`);
        }
        catch (error) {
            logger_1.default.error('Failed to send contact notifications:', error);
        }
    }
    static async getAllContacts(filters) {
        const { status, page = 1, limit = 20, search } = filters;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { contactNumber: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [contacts, total, counts] = await Promise.all([
            prisma_1.default.contact.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.contact.count({ where }),
            prisma_1.default.contact.groupBy({
                by: ['status'],
                _count: true,
            }),
        ]);
        const statusCounts = counts.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
        }, {});
        return {
            contacts,
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
    static async getContactById(contactId, userId, role) {
        const contact = await prisma_1.default.contact.findUnique({
            where: { id: contactId },
        });
        if (!contact) {
            throw new NotFoundError_1.NotFoundError("Contact not found");
        }
        if (role !== client_1.Role.ADMIN) {
            throw new NotFoundError_1.NotFoundError("Contact not found");
        }
        if (contact.status === client_1.ContactStatus.UNREAD) {
            await prisma_1.default.contact.update({
                where: { id: contactId },
                data: { status: client_1.ContactStatus.READ },
            });
            contact.status = client_1.ContactStatus.READ;
        }
        return contact;
    }
    static async deleteContact(contactId, adminId) {
        const contact = await prisma_1.default.contact.findUnique({
            where: { id: contactId },
        });
        if (!contact) {
            throw new NotFoundError_1.NotFoundError("Contact not found");
        }
        await prisma_1.default.contact.delete({ where: { id: contactId } });
        logger_1.default.info(`Contact ${contact.contactNumber} deleted by admin ${adminId}`);
    }
}
exports.ContactService = ContactService;
