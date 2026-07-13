import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { testSMTPConnection } from "../services/mail.services";
import { ForbiddenError } from "../errors/ForbiddenError";
import { BadRequestError } from "../errors/BadRequestError";
import { Role } from "@prisma/client";
// import Logger from "../config/logger";
import { render } from "../utils/mailTemplate";
import { sendGraphMail } from "../services/mail.services";
import { MailInterface } from "../interfaces/mail.interfaces";

/**
 * Test email configuration (Admin only)
 */
export const testEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can test email configuration");
    }

    const { email } = req.body;

    if (!email) {
      throw new BadRequestError("Email address is required");
    }

    // Send test email
    const html = await render("test-email", {
      fullName: user.fullName || "Admin",
      currentYear: new Date().getFullYear(),
    });

    const mailOptions: MailInterface = {
      to: email,
      from: `"Property Management" ${process.env.SENDER_EMAIL}`,
      subject: "SMTP Test - Property Management",
      text: "This is a test email to verify SMTP integration is working.",
      html,
    };

    await sendGraphMail(mailOptions);

    sendSuccessResponse(res, "Test email sent successfully", {
      to: email,
      from: process.env.SENDER_EMAIL,
      provider: "Brevo SMTP",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get email status (Admin only)
 */
export const getEmailStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view email status");
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
    const isConnected = await testSMTPConnection();

    sendSuccessResponse(res, "Email status retrieved", {
      ...status,
      isConnected,
    });
  } catch (error) {
    next(error);
  }
};