"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const crypto_1 = __importDefault(require("crypto"));
const BadRequestError_1 = require("../errors/BadRequestError");
const NotFoundError_1 = require("../errors/NotFoundError");
const logger_1 = __importDefault(require("../config/logger"));
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
class NewsletterService {
    static generateUnsubscribeToken() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    static async subscribe(data) {
        const { name, email } = data;
        const existing = await prisma_1.default.newsletterSubscriber.findUnique({
            where: { email },
        });
        if (existing) {
            if (existing.isSubscribed) {
                throw new BadRequestError_1.BadRequestError("This email is already subscribed to our newsletter");
            }
            const updated = await prisma_1.default.newsletterSubscriber.update({
                where: { id: existing.id },
                data: {
                    name,
                    isSubscribed: true,
                    subscribedAt: new Date(),
                    unsubscribedAt: null,
                    unsubscribeReason: null,
                },
            });
            await this.sendConfirmationEmail(updated);
            logger_1.default.info(`Newsletter re-subscription: ${email}`);
            return updated;
        }
        const subscriber = await prisma_1.default.newsletterSubscriber.create({
            data: {
                name,
                email,
                isSubscribed: true,
                unsubscribeToken: this.generateUnsubscribeToken(),
            },
        });
        await this.sendConfirmationEmail(subscriber);
        logger_1.default.info(`Newsletter subscription: ${email}`);
        return subscriber;
    }
    static async sendConfirmationEmail(subscriber) {
        try {
            const unsubscribeUrl = `${process.env.FRONTEND_URL}/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`;
            const html = await (0, mailTemplate_1.render)('newsletter-confirmation', {
                name: subscriber.name,
                email: subscriber.email,
                unsubscribeUrl,
                currentYear: new Date().getFullYear(),
            });
            await (0, mail_services_1.sendGraphMail)({
                to: subscriber.email,
                from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
                subject: "Thank you for subscribing to PropertyArk Newsletter!",
                text: `Thank you for subscribing, ${subscriber.name}!`,
                html,
            });
            logger_1.default.info(`Newsletter confirmation sent to ${subscriber.email}`);
        }
        catch (error) {
            logger_1.default.error('Failed to send newsletter confirmation:', error);
        }
    }
    static async getAllSubscribers(filters) {
        const { isSubscribed, page = 1, limit = 20, search } = filters;
        const skip = (page - 1) * limit;
        const where = {};
        if (isSubscribed !== undefined)
            where.isSubscribed = isSubscribed;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [subscribers, total, activeCount, unsubscribedCount] = await Promise.all([
            prisma_1.default.newsletterSubscriber.findMany({
                where,
                skip,
                take: limit,
                orderBy: { subscribedAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    isSubscribed: true,
                    subscribedAt: true,
                    unsubscribedAt: true,
                    unsubscribeReason: true,
                },
            }),
            prisma_1.default.newsletterSubscriber.count({ where }),
            prisma_1.default.newsletterSubscriber.count({ where: { isSubscribed: true } }),
            prisma_1.default.newsletterSubscriber.count({ where: { isSubscribed: false } }),
        ]);
        return {
            subscribers,
            counts: {
                total,
                active: activeCount,
                unsubscribed: unsubscribedCount,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    static async unsubscribeByToken(token, reason) {
        const subscriber = await prisma_1.default.newsletterSubscriber.findUnique({
            where: { unsubscribeToken: token },
        });
        if (!subscriber) {
            throw new NotFoundError_1.NotFoundError("Invalid unsubscribe link");
        }
        if (!subscriber.isSubscribed) {
            return {
                message: "You are already unsubscribed",
                email: subscriber.email,
            };
        }
        await prisma_1.default.newsletterSubscriber.update({
            where: { id: subscriber.id },
            data: {
                isSubscribed: false,
                unsubscribedAt: new Date(),
                unsubscribeReason: reason || null,
            },
        });
        logger_1.default.info(`Newsletter unsubscribe by token: ${subscriber.email}`);
        return {
            message: "You have been successfully unsubscribed",
            email: subscriber.email,
        };
    }
    static async unsubscribeByEmail(email, reason) {
        const subscriber = await prisma_1.default.newsletterSubscriber.findUnique({
            where: { email },
        });
        if (!subscriber) {
            throw new NotFoundError_1.NotFoundError("Email not found in our newsletter list");
        }
        if (!subscriber.isSubscribed) {
            throw new BadRequestError_1.BadRequestError("This email is already unsubscribed");
        }
        await prisma_1.default.newsletterSubscriber.update({
            where: { id: subscriber.id },
            data: {
                isSubscribed: false,
                unsubscribedAt: new Date(),
                unsubscribeReason: reason || null,
            },
        });
        logger_1.default.info(`Newsletter unsubscribe by email: ${email}`);
        return {
            message: "Successfully unsubscribed",
            email,
        };
    }
    static async deleteSubscriber(subscriberId, adminId) {
        const subscriber = await prisma_1.default.newsletterSubscriber.findUnique({
            where: { id: subscriberId },
        });
        if (!subscriber) {
            throw new NotFoundError_1.NotFoundError("Subscriber not found");
        }
        await prisma_1.default.newsletterSubscriber.delete({
            where: { id: subscriberId },
        });
        logger_1.default.info(`Newsletter subscriber ${subscriber.email} deleted by admin ${adminId}`);
    }
}
exports.NewsletterService = NewsletterService;
