import prisma from "../prisma";
import crypto from "crypto";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import Logger from "../config/logger";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";

export class NewsletterService {

  private static generateUnsubscribeToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async subscribe(data: {
    name: string;
    email: string;
  }): Promise<any> {
    const { name, email } = data;

    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.isSubscribed) {
        throw new BadRequestError(
          "This email is already subscribed to our newsletter"
        );
      }

      const updated = await prisma.newsletterSubscriber.update({
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
      Logger.info(`Newsletter re-subscription: ${email}`);
      return updated;
    }

    const subscriber = await prisma.newsletterSubscriber.create({
      data: {
        name,
        email,
        isSubscribed: true,
        unsubscribeToken: this.generateUnsubscribeToken(),
      },
    });

    await this.sendConfirmationEmail(subscriber);

    Logger.info(`Newsletter subscription: ${email}`);
    return subscriber;
  }

  private static async sendConfirmationEmail(subscriber: any): Promise<void> {
    try {
      const unsubscribeUrl = `${process.env.FRONTEND_URL}/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`;

      const html = await render('newsletter-confirmation', {
        name: subscriber.name,
        email: subscriber.email,
        unsubscribeUrl,
        currentYear: new Date().getFullYear(),
      });

      await sendGraphMail({
        to: subscriber.email,
        from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
        subject: "Thank you for subscribing to PropertyArk Newsletter!",
        text: `Thank you for subscribing, ${subscriber.name}!`,
        html,
      });

      Logger.info(`Newsletter confirmation sent to ${subscriber.email}`);
    } catch (error) {
      Logger.error('Failed to send newsletter confirmation:', error);
    }
  }

  static async getAllSubscribers(filters: {
    isSubscribed?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<any> {
    const { isSubscribed, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isSubscribed !== undefined) where.isSubscribed = isSubscribed;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [subscribers, total, activeCount, unsubscribedCount] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
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
      prisma.newsletterSubscriber.count({ where }),
      prisma.newsletterSubscriber.count({ where: { isSubscribed: true } }),
      prisma.newsletterSubscriber.count({ where: { isSubscribed: false } }),
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


  static async unsubscribeByToken(
    token: string,
    reason?: string
  ): Promise<any> {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      throw new NotFoundError("Invalid unsubscribe link");
    }

    if (!subscriber.isSubscribed) {
      return {
        message: "You are already unsubscribed",
        email: subscriber.email,
      };
    }

    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        isSubscribed: false,
        unsubscribedAt: new Date(),
        unsubscribeReason: reason || null,
      },
    });

    Logger.info(`Newsletter unsubscribe by token: ${subscriber.email}`);
    return {
      message: "You have been successfully unsubscribed",
      email: subscriber.email,
    };
  }


  static async unsubscribeByEmail(
    email: string,
    reason?: string
  ): Promise<any> {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (!subscriber) {
      throw new NotFoundError("Email not found in our newsletter list");
    }

    if (!subscriber.isSubscribed) {
      throw new BadRequestError("This email is already unsubscribed");
    }

    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        isSubscribed: false,
        unsubscribedAt: new Date(),
        unsubscribeReason: reason || null,
      },
    });

    Logger.info(`Newsletter unsubscribe by email: ${email}`);
    return {
      message: "Successfully unsubscribed",
      email,
    };
  }


  static async deleteSubscriber(subscriberId: string, adminId: string): Promise<void> {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { id: subscriberId },
    });

    if (!subscriber) {
      throw new NotFoundError("Subscriber not found");
    }

    await prisma.newsletterSubscriber.delete({
      where: { id: subscriberId },
    });

    Logger.info(`Newsletter subscriber ${subscriber.email} deleted by admin ${adminId}`);
  }
}