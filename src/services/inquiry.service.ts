import prisma from "../prisma";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { BadRequestError } from "../errors/BadRequestError";
import { Role, InquiryStatus, MeetingType, PropertyListingStatus } from "@prisma/client";
import Logger from "../config/logger";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";
import { MailInterface } from "../interfaces/mail.interfaces";
import { VendorService } from "./vendor.service";

export class InquiryService {

  private static generateInquiryNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INQ-${year}-${random}`;
  }

  static async createInquiry(
    userId: string,
    data: {
      propertyId: string;
      name: string;
      location: string;
      message: string;
      meetingType: MeetingType;
      proposedDate: string;
    }
  ): Promise<any> {
    const { propertyId, name, location, message, meetingType, proposedDate  } = data;

    const property = await prisma.property.findUnique({
      where: { 
        id: propertyId,
        listingStatus: PropertyListingStatus.ACTIVE
      },
      include: {
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found or not available");
    }

    if (!property.vendor) {
      throw new BadRequestError("Property has no vendor associated");
    }

    const inquiryData: any = {
      inquiryNumber: this.generateInquiryNumber(),
      userId,
      propertyId,
      vendorId: property.vendorId,
      name,
      location,
      message,
      meetingType,
      status: InquiryStatus.PENDING
    };  

    if (proposedDate) {
      const proposedDateTime = new Date(proposedDate);
      if (isNaN(proposedDateTime.getTime())) {
        throw new BadRequestError("Invalid proposed date format");
      }

      if (proposedDateTime < new Date()) {
        throw new BadRequestError("Proposed date must be in the future");
      }

     const isAvailable = await VendorService.isAvailable(
      property.vendorId,
      proposedDateTime
    );

    // if (!isAvailable) {
    //   throw new BadRequestError("Vendor is not available at the proposed date and time");
    // }
     if (!isAvailable) {
        inquiryData.proposedDate = proposedDateTime;
      } else {
        inquiryData.proposedDate = proposedDateTime;
      }
    }

    const inquiry = await prisma.inquiry.create({
      data: inquiryData,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            listingType: true
          }
        }
      }
    });

    // Increment inquiry count on property
    await prisma.property.update({
      where: { id: propertyId },
      data: { inquiryCount: { increment: 1 } }
    });

    await this.sendInquiryNotifications(inquiry, property);

    Logger.info(`Inquiry ${inquiry.inquiryNumber} created by user ${userId} for property ${propertyId}`);
    return inquiry;
  }

  private static async sendInquiryNotifications(inquiry: any, property: any): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: property.vendorId,
          type: 'GENERAL',
          title: 'New Property Inquiry',
          message: `${inquiry.name} has inquired about your property "${property.name}"`,
          data: {
            inquiryId: inquiry.id,
            propertyId: property.id,
            inquiryNumber: inquiry.inquiryNumber,
            meetingType: inquiry.meetingType
          }
        }
      });

      // Send email notification to vendor
      if (property.vendor.email) {
        const emailHtml = await render('inquiry-notification', {
          vendorName: property.vendor.fullName,
          inquiryName: inquiry.name,
          inquiryLocation: inquiry.location,
          inquiryMessage: inquiry.message,
          inquiryNumber: inquiry.inquiryNumber,
          meetingType: inquiry.meetingType,
          propertyName: property.name,
          propertyAddress: property.address,
          propertyCity: property.city,
          inquiryDate: new Date().toLocaleString(),
          dashboardUrl: `${process.env.FRONTEND_URL}/vendor/inquiries`,
          currentYear: new Date().getFullYear()
        });

        const mailOptions: MailInterface = {
          to: property.vendor.email,
          from: `"Property Management" ${process.env.SENDER_EMAIL}`,
          subject: `New Inquiry: ${inquiry.inquiryNumber} - ${property.name}`,
          text: `You have a new inquiry from ${inquiry.name} about ${property.name}`,
          html: emailHtml
        };

        await sendGraphMail(mailOptions);
        Logger.info(`Inquiry notification email sent to vendor ${property.vendor.email}`);
      }

      // Send confirmation email to inquirer
      if (inquiry.user.email) {
        const emailHtml = await render('inquiry-confirmation', {
          userName: inquiry.user.fullName,
          inquiryName: inquiry.name,
          inquiryNumber: inquiry.inquiryNumber,
          propertyName: property.name,
          propertyAddress: property.address,
          propertyCity: property.state,
          meetingType: inquiry.meetingType,
          inquiryDate: new Date().toLocaleString(),
          currentYear: new Date().getFullYear()
        });

        const mailOptions: MailInterface = {
          to: inquiry.user.email,
          from: `"Property Management" ${process.env.SENDER_EMAIL}`,
          subject: `Inquiry Confirmation: ${inquiry.inquiryNumber}`,
          text: `Your inquiry about ${property.name} has been sent successfully.`,
          html: emailHtml
        };

        await sendGraphMail(mailOptions);
        Logger.info(`Inquiry confirmation email sent to ${inquiry.user.email}`);
      }
    } catch (error) {
      Logger.error('Failed to send inquiry notifications:', error);
    }
  }

  static async getVendorInquiries(
    vendorId: string,
    filters: {
      status?: InquiryStatus;
      propertyId?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const { status, propertyId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = { vendorId };

    if (status) {
      where.status = status;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const [inquiries, total, counts] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatar: true
            }
          },
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              listingType: true,
              media: {
                take: 1,
                where: { isPrimary: true },
                select: { url: true }
              }
            }
          }
        }
      }),
      prisma.inquiry.count({ where }),
      prisma.inquiry.groupBy({
        by: ['status'],
        where: { vendorId },
        _count: true
      })
    ]);

    const statusCounts = counts.reduce((acc: any, item: any) => {
      acc[item.status] = item._count;
      return acc;
    }, {});

    return {
      inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      counts: {
        pending: statusCounts.PENDING || 0,
        accepted: statusCounts.ACCEPTED || 0,
        declined: statusCounts.DECLINED || 0,
        total
      }
    };
  }

  static async getUserInquiries(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              listingType: true,
              media: {
                take: 1,
                where: { isPrimary: true },
                select: { url: true }
              },
              vendor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                  avatar: true
                }
              }
            }
          }
        }
      }),
      prisma.inquiry.count({ where: { userId } })
    ]);

    return {
      inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async getInquiryById(inquiryId: string, userId: string, role: Role): Promise<any> {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true
          }
        },
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            listingType: true,
            media: {
              take: 1,
              where: { isPrimary: true },
              select: { url: true }
            }
          }
        }
      }
    });

    if (!inquiry) {
      throw new NotFoundError("Inquiry not found");
    }

    const isUser = inquiry.userId === userId;
    const isVendor = inquiry.vendorId === userId;
    const isAdmin = role === Role.ADMIN;

    if (!isUser && !isVendor && !isAdmin) {
      throw new ForbiddenError("You don't have access to this inquiry");
    }

    if (isVendor && !inquiry.viewedAt) {
      await prisma.inquiry.update({
        where: { id: inquiryId },
        data: { viewedAt: new Date() }
      });
      inquiry.viewedAt = new Date();
    }

    return inquiry;
  }

  static async reviewInquiry(
    inquiryId: string,
    vendorId: string,
    data: {
      status: 'ACCEPTED' | 'DECLINED';
      reason?: string;
      scheduledDate?: string;
    }
  ): Promise<any> {
    const { status, reason, scheduledDate } = data;

    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            vendorId: true,
            vendor: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!inquiry) {
      throw new NotFoundError("Inquiry not found");
    }

    if (inquiry.vendorId !== vendorId) {
      throw new ForbiddenError("You don't have permission to review this inquiry");
    }

    if (inquiry.status !== InquiryStatus.PENDING) {
      throw new BadRequestError(`Inquiry is already ${inquiry.status.toLowerCase()}`);
    }

    if (status === 'DECLINED' && !reason) {
      throw new BadRequestError("Reason is required when declining an inquiry");
    }

    const updateData: any = {
      status: status as InquiryStatus,
      respondedAt: new Date()
    };

    if (status === 'DECLINED') {
      updateData.responseNote = reason;
    }

    if (status === 'ACCEPTED') {
      if (!scheduledDate) {
        throw new BadRequestError("Scheduled date is required when accepting an inquiry");
      }

      const scheduledDateTime = new Date(scheduledDate);
      if (isNaN(scheduledDateTime.getTime())) {
        throw new BadRequestError("Invalid scheduled date format");
      }

      // Validate scheduled date is in the future
      if (scheduledDateTime < new Date()) {
        throw new BadRequestError("Scheduled date must be in the future");
      }

      // Check vendor availability
      const isAvailable = await VendorService.isAvailable(
        vendorId,
        scheduledDateTime
      );

      //  if (!isAvailable) {
      //   throw new BadRequestError("You are not available at the scheduled date and time. Please set your availability first.");
      // }
      // updateData.scheduledDate = scheduledDateTime;

      if (!isAvailable) {
        updateData.scheduledDate = scheduledDateTime;
        if (!updateData.responseNote) {
          updateData.responseNote = "Scheduled outside of regular availability hours";
        }
      } else {
        updateData.scheduledDate = scheduledDateTime;
      }
    }

    const updatedInquiry = await prisma.inquiry.update({
      where: { id: inquiryId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        }
      }
    });

    await this.sendReviewNotification(updatedInquiry, status, reason);

    Logger.info(`Inquiry ${inquiry.inquiryNumber} ${status.toLowerCase()} by vendor ${vendorId}`);
    return updatedInquiry;
  }

  private static async sendReviewNotification(
    inquiry: any,
    status: 'ACCEPTED' | 'DECLINED',
    reason?: string,
    scheduledDate?: string
  ): Promise<void> {
    try {
      const isAccepted = status === 'ACCEPTED';
      let message = isAccepted
        ? `Your inquiry about "${inquiry.property.name}" has been accepted`
        : `Your inquiry about "${inquiry.property.name}" has been declined${reason ? `: ${reason}` : ''}`;

      if (isAccepted && scheduledDate) {
        const date = new Date(scheduledDate);
        message += ` for ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
      }

      await prisma.notification.create({
        data: {
          userId: inquiry.userId,
          type: 'GENERAL',
          title: isAccepted ? 'Inquiry Accepted' : 'Inquiry Declined',
          message: isAccepted
            ? `Your inquiry about "${inquiry.property.name}" has been accepted`
            : `Your inquiry about "${inquiry.property.name}" has been declined${reason ? `: ${reason}` : ''}`,
          data: {
            inquiryId: inquiry.id,
            propertyId: inquiry.property.id,
            inquiryNumber: inquiry.inquiryNumber,
            status,
            ...(reason && { reason }),
            ...(scheduledDate && { scheduledDate })
          }
        }
      });

      if (inquiry.user.email) {
        const templateName = isAccepted ? 'inquiry-accepted' : 'inquiry-declined';
        const subject = isAccepted
          ? `Inquiry Accepted: ${inquiry.inquiryNumber}`
          : `Inquiry Declined: ${inquiry.inquiryNumber}`;

        const emailHtml = await render(templateName, {
          userName: inquiry.user.fullName,
          inquiryNumber: inquiry.inquiryNumber,
          propertyName: inquiry.property.name,
          status: status,
          ...(reason && { reason }),
          ...(scheduledDate && { 
            scheduledDate: new Date(scheduledDate).toLocaleString() 
          }),
          currentYear: new Date().getFullYear(),
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
        });

        const mailOptions: MailInterface = {
          to: inquiry.user.email,
          from: `"Property Management" ${process.env.SENDER_EMAIL}`,
          subject,
          text: `Your inquiry ${inquiry.inquiryNumber} has been ${status.toLowerCase()}`,
          html: emailHtml
        };

        await sendGraphMail(mailOptions);
        Logger.info(`Inquiry review email sent to ${inquiry.user.email}`);
      }
    } catch (error) {
      Logger.error('Failed to send inquiry review notification:', error);
    }
  }


  static async getInquiryStats(vendorId: string): Promise<any> {
    const [total, pending, accepted, declined, byProperty] = await Promise.all([
      prisma.inquiry.count({ where: { vendorId } }),
      prisma.inquiry.count({ where: { vendorId, status: InquiryStatus.PENDING } }),
      prisma.inquiry.count({ where: { vendorId, status: InquiryStatus.ACCEPTED } }),
      prisma.inquiry.count({ where: { vendorId, status: InquiryStatus.DECLINED } }),
      prisma.inquiry.groupBy({
        by: ['propertyId'],
        where: { vendorId },
        _count: true,
        orderBy: { _count: { propertyId: 'desc' } },
        take: 10
      })
    ]);

    const propertyIds = byProperty.map(item => item.propertyId);
    let propertyMap = new Map();
    
    if (propertyIds.length > 0) {
      const properties = await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, name: true }
      });
      
      propertyMap = new Map(properties.map(p => [p.id, p]));
    }

    return {
      total,
      pending,
      accepted,
      declined,
      byProperty: byProperty.map((item: any) => ({
        propertyId: item.propertyId,
        propertyName: propertyMap.get(item.propertyId)?.name || 'Unknown Property',
        count: item._count
      }))
    };
  }
}