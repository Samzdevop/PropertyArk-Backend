import prisma from "../prisma";
import { ServiceType, ContactStatus, Role } from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import Logger from "../config/logger";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";
// import { MailInterface } from "../interfaces/mail.interfaces";
import { uploadMultipleToAzure, STORAGE_CONTAINERS } from "../config/upload";
// import { MediaType } from "@prisma/client";

export class ProfessionalServiceService {

  private static generateRequestNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PSR-${year}-${random}`;
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

    const emails = admins.map(a => a.email);

    if (emails.length === 0) {
      Logger.warn('No admin emails found in database');
    }

    return emails;
  }


  static async createRequest(
    userId: string | null,
    data: {
      fullName: string;
      email: string;
      phone?: string;
      serviceType: ServiceType;
      consultationDate: string;
      propertyReference?: string;
      message: string;
    },
    files: Express.Multer.File[]
  ): Promise<any> {
    const {
      fullName,
      email,
      phone,
      serviceType,
      consultationDate,
      propertyReference,
      message
    } = data;
    const consultDate = new Date(consultationDate);
    if (isNaN(consultDate.getTime())) {
      throw new BadRequestError("Invalid consultation date format");
    }

    if (consultDate < new Date()) {
      throw new BadRequestError("Consultation date must be in the future");
    }

    const request = await prisma.professionalService.create({
      data: {
        requestNumber: this.generateRequestNumber(),
        userId: userId || null,
        fullName,
        email,
        phone: phone || null,
        serviceType,
        consultationDate: consultDate,
        propertyReference: propertyReference || null,
        message,
        status: ContactStatus.UNREAD
      }
    });

    if (files && files.length > 0) {
      await this.uploadDocuments(request.id, files);
    }
    await this.sendNotifications(request, files?.length || 0);
    Logger.info(`Professional service request ${request.requestNumber} created by ${email}`);
    return this.getRequestById(request.id, userId, 'USER');
  }


  private static async uploadDocuments(
    requestId: string,
    files: Express.Multer.File[]
  ): Promise<void> {
    try {
      const storageDriver = process.env.STORAGE_DRIVER || 'local';
      const container = 'professional-service-documents';

      const documentsData: any[] = [];

      for (const file of files) {
        let url: string;
        let key: string;

        if (storageDriver === 'azure') {
          const urls = await uploadMultipleToAzure([file], container);
          url = urls[0];
          key = url.split('/').pop() || file.originalname;
        } else if (storageDriver === 's3') {
          url = (file as any).location || `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${(file as any).key}`;
          key = (file as any).key || file.originalname;
        } else {
          url = `/uploads/${file.filename}`;
          key = file.filename;
        }

        documentsData.push({
          name: file.originalname,
          type: 'OTHER' as any,
          url,
          key,
          size: file.size,
          mimeType: file.mimetype,
          container,
          uploadedById: (await prisma.professionalService.findUnique({
            where: { id: requestId },
            select: { userId: true, email: true }
          }))?.userId || 'system',
          professionalServiceId: requestId
        });
      }

      if (documentsData.length > 0) {
        await prisma.document.createMany({ data: documentsData });
      }
    } catch (error) {
      Logger.error('Failed to upload documents:', error);
    }
  }


  private static async sendNotifications(
    request: any,
    documentCount: number
  ): Promise<void> {
    try {
      const adminEmails = await this.getAdminEmails();

    //   if (adminEmails.length === 0) {
    //     Logger.warn('No admins found to notify about professional service request');
    //   } else {
        const adminEmailHtml = await render('professional-service-admin', {
            requestNumber: request.requestNumber,
            fullName: request.fullName,
            email: request.email,
            phone: request.phone || 'Not provided',
            serviceType: request.serviceType,
            consultationDate: new Date(request.consultationDate).toLocaleString(),
            propertyReference: request.propertyReference || 'Not provided',
            message: request.message,
            documentCount,
            submittedAt: new Date().toLocaleString(),
            currentYear: new Date().getFullYear(),
            // dashboardUrl: `${process.env.FRONTEND_URL}/admin/professional-services`,
        });
        const adminEmailPromises = adminEmails.map(adminEmail =>
            sendGraphMail({
                to: adminEmails || process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL!,
                from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
                subject: `New Professional Service Request: ${request.requestNumber}`,
                text: `New request from ${request.fullName}`,
                html: adminEmailHtml,
            }).catch(error => {
                Logger.error(`Failed to send to admin ${adminEmail}:`, error);
            })
        );

        await Promise.all(adminEmailPromises);
        Logger.info(`Admin notifications sent to ${adminEmails.length} admin(s)`);
        
      const userEmailHtml = await render('professional-service-confirmation', {
        fullName: request.fullName,
        requestNumber: request.requestNumber,
        serviceType: request.serviceType,
        consultationDate: new Date(request.consultationDate).toLocaleString(),
        currentYear: new Date().getFullYear(),
      });

      await sendGraphMail({
        to: request.email,
        from: `"PropertyArk" ${process.env.SENDER_EMAIL}`,
        subject: `We've received your request: ${request.requestNumber}`,
        text: `Your request has been received`,
        html: userEmailHtml,
      });

      Logger.info(`Professional service notifications sent for ${request.requestNumber}`);
    } catch (error) {
      Logger.error('Failed to send professional service notifications:', error);
    }
  }


  static async getAllRequests(filters: {
    status?: ContactStatus;
    serviceType?: ServiceType;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<any> {
    const { status, serviceType, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (serviceType) where.serviceType = serviceType;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { requestNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [requests, total, counts] = await Promise.all([
      prisma.professionalService.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          documents: {
            select: {
              id: true,
              name: true,
              url: true,
              size: true,
              mimeType: true,
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.professionalService.count({ where }),
      prisma.professionalService.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const statusCounts = counts.reduce((acc: any, item: any) => {
      acc[item.status] = item._count;
      return acc;
    }, {});

    return {
      requests,
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


  static async getRequestById(
    requestId: string,
    userId: string | null,
    role: Role | 'USER'
  ): Promise<any> {
    const request = await prisma.professionalService.findUnique({
      where: { id: requestId },
      include: {
        documents: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundError("Professional service request not found");
    }

    const isAdmin = role === Role.ADMIN;
    const isOwner = userId && request.userId === userId;

    if (!isAdmin && !isOwner) {
      throw new NotFoundError("Request not found"); 
    }

    if (isAdmin && request.status === ContactStatus.UNREAD) {
      await prisma.professionalService.update({
        where: { id: requestId },
        data: { status: ContactStatus.READ },
      });
      request.status = ContactStatus.READ;
    }

    return request;
  }




  static async deleteRequest(requestId: string, adminId: string): Promise<void> {
    const request = await prisma.professionalService.findUnique({
      where: { id: requestId },
      include: { documents: true },
    });

    if (!request) {
      throw new NotFoundError("Professional service request not found");
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      await tx.document.deleteMany({
        where: { professionalServiceId: requestId },
      });

      await tx.professionalService.delete({
        where: { id: requestId },
      });
    });

    Logger.info(`Professional service request ${request.requestNumber} deleted by admin ${adminId}`);
  }
}