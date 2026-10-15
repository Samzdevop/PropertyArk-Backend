import prisma from "../prisma";
import { ContactStatus, Role } from "@prisma/client";
import { NotFoundError } from "../errors/NotFoundError";
import Logger from "../config/logger";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";

export class ContactService {

  private static generateContactNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CNT-${year}-${random}`;
  }

  private static async getAdminEmails(): Promise<string[]> {
    const admins = await prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        isVerified: true,
        isSuspended: false,
        isDeleted: false,
        email: { not: '' },
      },
      select: { email: true },
    });

    return admins.map(a => a.email);
  }


  static async createContact(data: {
    fullName: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<any> {
    const contact = await prisma.contact.create({
      data: {
        contactNumber: this.generateContactNumber(),
        fullName: data.fullName,
        email: data.email,
        subject: data.subject,
        message: data.message,
        status: ContactStatus.UNREAD,
      },
    });

    await this.sendNotifications(contact);

    Logger.info(`Contact message ${contact.contactNumber} created by ${data.email}`);
    return contact;
  }

  private static async sendNotifications(contact: any): Promise<void> {
    try {
        const adminEmails = await this.getAdminEmails();

        // if (adminEmails.length === 0) {
        //     Logger.warn('No admins found to notify about contact message');
        // } else {
        const adminHtml = await render('contact-us-admin', {
            contactNumber: contact.contactNumber,
            fullName: contact.fullName,
            email: contact.email,
            subject: contact.subject,
            message: contact.message,
            submittedAt: new Date().toLocaleString(),
            currentYear: new Date().getFullYear(),
            // dashboardUrl: `${process.env.FRONTEND_URL}/admin/contacts`
        });
        const adminEmailPromises = adminEmails.map(adminEmail =>
        sendGraphMail({
            to: adminEmails || process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL!,
            from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
            subject: `New Contact: ${contact.subject}`,
            text: `New contact message from ${contact.fullName}`,
            html: adminHtml,
        }).catch(error => {
            Logger.error(`Failed to send contact notification to ${adminEmail}:`, error);
        })
      );

      await Promise.all(adminEmailPromises);
      Logger.info(`Admin notifications sent to ${adminEmails.length} admin(s)`);
       
      

      const userHtml = await render('contact-us-confirmation', {
        fullName: contact.fullName,
        contactNumber: contact.contactNumber,
        subject: contact.subject,
        message: contact.message,
        currentYear: new Date().getFullYear(),
      });

      await sendGraphMail({
        to: contact.email,
        from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
        subject: `We've received your message: ${contact.contactNumber}`,
        text: `Your message has been received`,
        html: userHtml,
      });

      Logger.info(`Contact notifications sent for ${contact.contactNumber}`);
    } catch (error) {
      Logger.error('Failed to send contact notifications:', error);
    }
  }

  static async getAllContacts(filters: {
    status?: ContactStatus;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<any> {
    const { status, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { contactNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total, counts] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where }),
      prisma.contact.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const statusCounts = counts.reduce((acc: any, item: any) => {
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

  static async getContactById(
    contactId: string,
    userId: string,
    role: Role
  ): Promise<any> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new NotFoundError("Contact not found");
    }

    if (role !== Role.ADMIN) {
      throw new NotFoundError("Contact not found");
    }
    if (contact.status === ContactStatus.UNREAD) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { status: ContactStatus.READ },
      });
      contact.status = ContactStatus.READ;
    }

    return contact;
  }

  static async deleteContact(contactId: string, adminId: string): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new NotFoundError("Contact not found");
    }

    await prisma.contact.delete({ where: { id: contactId } });
    Logger.info(`Contact ${contact.contactNumber} deleted by admin ${adminId}`);
  }
}