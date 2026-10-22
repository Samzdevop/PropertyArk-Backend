"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeService = void 0;
// services/welcome.service.ts
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../config/logger"));
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
class WelcomeService {
    static async sendWelcomeNotification(userId, role) {
        try {
            const user = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    role: true,
                },
            });
            if (!user) {
                logger_1.default.warn(`Welcome notification skipped: user ${userId} not found`);
                return;
            }
            const content = this.getWelcomeContent(user.role, user.fullName);
            await prisma_1.default.notification.create({
                data: {
                    userId: user.id,
                    type: client_1.NotificationType.GENERAL,
                    title: content.title,
                    message: content.message,
                    data: {
                        type: "WELCOME",
                        role: user.role,
                        actionUrl: content.actionUrl,
                        actionLabel: content.actionLabel,
                        benefits: content.benefits,
                    },
                    channel: client_1.NotificationChannel.BOTH,
                    priority: client_1.NotificationPriority.HIGH,
                    sentAt: new Date(),
                },
            });
            if (user.email) {
                await this.sendWelcomeEmail(user, content);
            }
            logger_1.default.info(`Welcome notification sent to ${user.email} (${user.role})`);
        }
        catch (error) {
            logger_1.default.error(`Failed to send welcome notification to user ${userId}:`, error);
        }
    }
    static getWelcomeContent(role, fullName) {
        const firstName = fullName.split(" ")[0] || "there";
        switch (role) {
            case client_1.Role.USER:
                return {
                    title: `🎉 Welcome to PropertyArk, ${firstName}!`,
                    message: "Your account is ready. Start exploring properties, save your favorites, and connect with vendors directly.",
                    actionUrl: "/properties",
                    actionLabel: "Browse Properties",
                    benefits: [
                        "Save your favorite properties",
                        "Chat directly with vendors",
                        "Send inquiries and schedule viewings",
                        "Track your inquiry history",
                    ],
                };
            case client_1.Role.VENDOR:
                return {
                    title: `Welcome to PropertyArk, ${firstName}!`,
                    message: "Your vendor account is set up. You've received your welcome bonus credit points. Get started by listing your first property!",
                    actionUrl: "/login",
                    actionLabel: "Go to Dashboard",
                    benefits: [
                        "List unlimited properties",
                        "Receive inquiries from interested buyers/renters",
                        "Feature properties to boost visibility",
                        "Track views and performance",
                        "Welcome bonus credit points added",
                    ],
                };
            case client_1.Role.STAFF:
                return {
                    title: ` Welcome to PropertyArk Team, ${firstName}!`,
                    message: "Your staff account is active. You can now handle support requests, manage inquiries, and assist users.",
                    actionUrl: "/login",
                    actionLabel: "Go to Staff Dashboard",
                    benefits: [
                        "Handle user and vendor support requests",
                        "Manage property inquiries",
                        "Access admin chat system",
                        "Help users resolve issues",
                    ],
                };
            case client_1.Role.ADMIN:
                return {
                    title: ` Welcome to PropertyArk Admin, ${firstName}!`,
                    message: "Your admin account is ready. You have full access to manage the platform.",
                    actionUrl: "/admin/dashboard",
                    actionLabel: "Go to Admin Dashboard",
                    benefits: [
                        "Manage all users and vendors",
                        "Review and approve properties",
                        "Send bulk notifications",
                        "Manage credit point settings",
                        "Access all platform analytics",
                    ],
                };
            default:
                return {
                    title: `Welcome to PropertyArk, ${firstName}!`,
                    message: "Your account is ready. Start exploring!",
                    actionUrl: "/",
                    actionLabel: "Get Started",
                    benefits: [],
                };
        }
    }
    static async sendWelcomeEmail(user, content) {
        const emailHtml = await (0, mailTemplate_1.render)("welcome", {
            fullName: user.fullName,
            role: user.role,
            title: content.title,
            message: content.message,
            actionUrl: `${process.env.FRONTEND_URL}${content.actionUrl}`,
            actionLabel: content.actionLabel,
            benefits: content.benefits,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: user.email,
            from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
            subject: content.title.replace("🎉 ", "").replace("🏢 ", "").replace("👔 ", "").replace("🔐 ", ""),
            text: content.message,
            html: emailHtml,
        };
        await (0, mail_services_1.sendGraphMail)(mailOptions);
    }
}
exports.WelcomeService = WelcomeService;
