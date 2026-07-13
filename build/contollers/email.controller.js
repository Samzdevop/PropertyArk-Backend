"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailStatus = exports.testEmail = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const mail_services_1 = require("../services/mail.services");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const BadRequestError_1 = require("../errors/BadRequestError");
const client_1 = require("@prisma/client");
// import Logger from "../config/logger";
const mailTemplate_1 = require("../utils/mailTemplate");
const mail_services_2 = require("../services/mail.services");
/**
 * Test email configuration (Admin only)
 */
const testEmail = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can test email configuration");
        }
        const { email } = req.body;
        if (!email) {
            throw new BadRequestError_1.BadRequestError("Email address is required");
        }
        // Send test email
        const html = await (0, mailTemplate_1.render)("test-email", {
            fullName: user.fullName || "Admin",
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Property Management" ${process.env.SENDER_EMAIL}`,
            subject: "SMTP Test - Property Management",
            text: "This is a test email to verify SMTP integration is working.",
            html,
        };
        await (0, mail_services_2.sendGraphMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Test email sent successfully", {
            to: email,
            from: process.env.SENDER_EMAIL,
            provider: "Brevo SMTP",
        });
    }
    catch (error) {
        next(error);
    }
};
exports.testEmail = testEmail;
/**
 * Get email status (Admin only)
 */
const getEmailStatus = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view email status");
        }
        const status = {
            provider: "Brevo SMTP (via Nodemailer)",
            enabled: process.env.SMTP_ENABLED !== 'false',
            host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            username: process.env.SMTP_USERNAME ? '***' : 'not set',
            senderEmail: process.env.SENDER_EMAIL || 'noreply@propertymanagement.com',
            senderName: process.env.SENDER_NAME || 'Property Management',
        };
        // Test connection
        const isConnected = await (0, mail_services_1.testSMTPConnection)();
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Email status retrieved", {
            ...status,
            isConnected,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getEmailStatus = getEmailStatus;
