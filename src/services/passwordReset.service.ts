import prisma from "../prisma";
import crypto from "crypto";
import { hash } from "argon2";
import { BadRequestError } from "../errors/BadRequestError";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";
import Logger from "../config/logger";

export class PasswordResetService {
  private static generateResetToken(): { rawToken: string; hashedToken: string } {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    
    return { rawToken, hashedToken };
  }

  static async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { 
        id: true, 
        email: true, 
        fullName: true,
        isVerified: true
      }
    });

    if (!user) {
      Logger.warn(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    if (!user.isVerified) {
      Logger.warn(`Password reset requested for unverified account: ${email}`);
      throw new BadRequestError("Please verify your email address first");
    }

    const { rawToken, hashedToken } = this.generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: expiresAt
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://properties.molaprise.com';
    const resetUrl = `${frontendUrl}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`;

    try {
      const emailHtml = await render('password-reset-request', {
        fullName: user.fullName,
        resetUrl,
        expiryMinutes: 30,
        currentYear: new Date().getFullYear()
      });

      await sendGraphMail({
        to: email,
        from: `"Property Management" ${process.env.SENDER_EMAIL}`,
        subject: "Password Reset Request",
        text: `Click the following link to reset your password: ${resetUrl}. This link expires in 30 minutes.`,
        html: emailHtml
      });

      Logger.info(`Password reset email sent to: ${email}`);
    } catch (error) {
      Logger.error(`Failed to send password reset email to ${email}:`, error);
      throw new BadRequestError("Failed to send reset email. Please try again.");
    }
  }


  static async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await prisma.user.findFirst({
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
      throw new BadRequestError("Invalid or expired reset token");
    }


    const hashedPassword = await hash(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null
      }
    });

    try {
      const emailHtml = await render('password-reset-confirmation', {
        fullName: user.fullName,
        currentYear: new Date().getFullYear(),
        loginUrl: `${process.env.FRONTEND_URL || 'https://properties.molaprise.com'}/`
      });

      await sendGraphMail({
        to: email,
        from: `"Property Management" ${process.env.SENDER_EMAIL}`,
        subject: "Password Reset Successful",
        text: "Your password has been successfully reset.",
        html: emailHtml
      });

      Logger.info(`Password reset successful for: ${email}`);
    } catch (error) {
      Logger.error(`Failed to send password reset confirmation to ${email}:`, error);
    }
  }

 
  // static async validateResetToken(email: string, token: string): Promise<boolean> {
  //   const hashedToken = crypto
  //     .createHash("sha256")
  //     .update(token)
  //     .digest("hex");

  //   const user = await prisma.user.findFirst({
  //     where: {
  //       email,
  //       passwordResetToken: hashedToken,
  //       passwordResetExpiresAt: {
  //         gt: new Date()
  //       }
  //     },
  //     select: { id: true }
  //   });

  //   return !!user;
  // }
}