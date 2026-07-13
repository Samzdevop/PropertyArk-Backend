"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const crypto_1 = __importDefault(require("crypto"));
const argon2_1 = require("argon2");
const BadRequestError_1 = require("../errors/BadRequestError");
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
const logger_1 = __importDefault(require("../config/logger"));
class PasswordResetService {
    static generateResetToken() {
        const rawToken = crypto_1.default.randomBytes(32).toString("hex");
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");
        return { rawToken, hashedToken };
    }
    static async requestPasswordReset(email) {
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                fullName: true,
                isVerified: true
            }
        });
        if (!user) {
            logger_1.default.warn(`Password reset requested for non-existent email: ${email}`);
            return;
        }
        if (!user.isVerified) {
            logger_1.default.warn(`Password reset requested for unverified account: ${email}`);
            throw new BadRequestError_1.BadRequestError("Please verify your email address first");
        }
        const { rawToken, hashedToken } = this.generateResetToken();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await prisma_1.default.user.update({
            where: { email },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpiresAt: expiresAt
            }
        });
        const frontendUrl = process.env.FRONTEND_URL || 'https://properties.molaprise.com';
        const resetUrl = `${frontendUrl}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`;
        try {
            const emailHtml = await (0, mailTemplate_1.render)('password-reset-request', {
                fullName: user.fullName,
                resetUrl,
                expiryMinutes: 30,
                currentYear: new Date().getFullYear()
            });
            await (0, mail_services_1.sendGraphMail)({
                to: email,
                from: `"Property Management" ${process.env.SENDER_EMAIL}`,
                subject: "Password Reset Request",
                text: `Click the following link to reset your password: ${resetUrl}. This link expires in 30 minutes.`,
                html: emailHtml
            });
            logger_1.default.info(`Password reset email sent to: ${email}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to send password reset email to ${email}:`, error);
            throw new BadRequestError_1.BadRequestError("Failed to send reset email. Please try again.");
        }
    }
    static async resetPassword(email, token, newPassword) {
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(token)
            .digest("hex");
        const user = await prisma_1.default.user.findFirst({
            where: {
                email,
                passwordResetToken: hashedToken,
                passwordResetExpiresAt: {
                    gt: new Date()
                }
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                passwordResetToken: true,
                passwordResetExpiresAt: true
            }
        });
        if (!user) {
            throw new BadRequestError_1.BadRequestError("Invalid or expired reset token");
        }
        const hashedPassword = await (0, argon2_1.hash)(newPassword);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpiresAt: null
            }
        });
        try {
            const emailHtml = await (0, mailTemplate_1.render)('password-reset-confirmation', {
                fullName: user.fullName,
                currentYear: new Date().getFullYear(),
                loginUrl: `${process.env.FRONTEND_URL || 'https://properties.molaprise.com'}/`
            });
            await (0, mail_services_1.sendGraphMail)({
                to: email,
                from: `"Property Management" ${process.env.SENDER_EMAIL}`,
                subject: "Password Reset Successful",
                text: "Your password has been successfully reset.",
                html: emailHtml
            });
            logger_1.default.info(`Password reset successful for: ${email}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to send password reset confirmation to ${email}:`, error);
        }
    }
}
exports.PasswordResetService = PasswordResetService;
