// services/welcome.service.ts
import prisma from "../prisma";
import { Role, NotificationType, NotificationChannel, NotificationPriority } from "@prisma/client";
import Logger from "../config/logger";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";
import { MailInterface } from "../interfaces/mail.interfaces";

export class WelcomeService {

  static async sendWelcomeNotification(
    userId: string,
    role: Role
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      });

      if (!user) {
        Logger.warn(`Welcome notification skipped: user ${userId} not found`);
        return;
      }

      const content = this.getWelcomeContent(user.role, user.fullName);
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.GENERAL,
          title: content.title,
          message: content.message,
          data: {
            type: "WELCOME",
            role: user.role,
            actionUrl: content.actionUrl,
            actionLabel: content.actionLabel,
            benefits: content.benefits,
          },
          channel: NotificationChannel.BOTH,
          priority: NotificationPriority.HIGH,
          sentAt: new Date(),
        },
      });

      if (user.email) {
        await this.sendWelcomeEmail(user, content);
      }
      Logger.info(`Welcome notification sent to ${user.email} (${user.role})`);
    } catch (error) {
      Logger.error(`Failed to send welcome notification to user ${userId}:`, error);
    }
  }

  private static getWelcomeContent(
    role: Role,
    fullName: string
  ): {
    title: string;
    message: string;
    actionUrl: string;
    actionLabel: string;
    benefits: string[];
  } {
    const firstName = fullName.split(" ")[0] || "there";

    switch (role) {
      case Role.USER:
        return {
          title: `🎉 Welcome to PropertyArk, ${firstName}!`,
          message:
            "Your account is ready. Start exploring properties, save your favorites, and connect with vendors directly.",
          actionUrl: "/properties",
          actionLabel: "Browse Properties",
          benefits: [
            "Save your favorite properties",
            "Chat directly with vendors",
            "Send inquiries and schedule viewings",
            "Track your inquiry history",
          ],
        };

      case Role.VENDOR:
        return {
          title: `Welcome to PropertyArk, ${firstName}!`,
          message:
            "Your vendor account is set up. You've received your welcome bonus credit points. Get started by listing your first property!",
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

      case Role.STAFF:
        return {
          title: ` Welcome to PropertyArk Team, ${firstName}!`,
          message:
            "Your staff account is active. You can now handle support requests, manage inquiries, and assist users.",
          actionUrl: "/login",
          actionLabel: "Go to Staff Dashboard",
          benefits: [
            "Handle user and vendor support requests",
            "Manage property inquiries",
            "Access admin chat system",
            "Help users resolve issues",
          ],
        };

      case Role.ADMIN:
        return {
          title: ` Welcome to PropertyArk Admin, ${firstName}!`,
          message:
            "Your admin account is ready. You have full access to manage the platform.",
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

 
  private static async sendWelcomeEmail(
    user: { email: string; fullName: string; role: Role },
    content: any
  ): Promise<void> {
    const emailHtml = await render("welcome", {
      fullName: user.fullName,
      role: user.role,
      title: content.title,
      message: content.message,
      actionUrl: `${process.env.FRONTEND_URL}${content.actionUrl}`,
      actionLabel: content.actionLabel,
      benefits: content.benefits,
      currentYear: new Date().getFullYear(),
    });

    const mailOptions: MailInterface = {
      to: user.email,
      from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
      subject: content.title.replace("🎉 ", "").replace("🏢 ", "").replace("👔 ", "").replace("🔐 ", ""),
      text: content.message,
      html: emailHtml,
    };

    await sendGraphMail(mailOptions);
  }
}