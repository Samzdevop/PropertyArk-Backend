import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { BadRequestError } from "../errors/BadRequestError";
import { Role, VerificationStatus } from "@prisma/client";
import { logActivity } from "../contollers/activity.controller";
import { STORAGE_CONTAINERS } from "../config/upload";


export const verifyVendorNIN = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { vendorId } = req.params;
    const { status, rejectionReason } = req.body;
    const admin = req.user as any;
    const vendorIdstr = vendorId as string

    if (admin.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can verify NIN");
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId as string, role: Role.VENDOR }
    });

    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }

    if (status === VerificationStatus.VERIFIED) {
      await prisma.user.update({
        where: { id: vendorId as string  },
        data: {
          ninVerificationStatus: VerificationStatus.VERIFIED,
          ninVerifiedAt: new Date(),
          ninVerifiedBy: admin.id,
          ninRejectionReason: null
        }
      });

      await prisma.notification.create({
        data: {
          userId: vendorId as string, 
          type: 'NIN_VERIFIED',
          title: 'NIN Verified',
          message: 'Your NIN has been verified. You can now list properties.',
          data: { verifiedBy: admin.id }
        }
      });

      await logActivity(
        admin.id,
        'VERIFY_VENDOR_NIN',
        'USER',
        vendorIdstr,
        { status: 'VERIFIED' },
        req
      );

      sendSuccessResponse(res, "Vendor NIN verified successfully");
    } else if (status === VerificationStatus.REJECTED) {
      if (!rejectionReason) {
        throw new BadRequestError("Rejection reason is required");
      }

      await prisma.user.update({
        where: { id: vendorId as string },
        data: {
          ninVerificationStatus: VerificationStatus.REJECTED,
          ninVerifiedAt: new Date(),
          ninVerifiedBy: admin.id,
          ninRejectionReason: rejectionReason
        }
      });

      // Create notification for vendor
      await prisma.notification.create({
        data: {
          userId: vendorId as string,
          type: 'NIN_REJECTED',
          title: 'NIN Rejected',
          message: `Your NIN was rejected. Reason: ${rejectionReason}`,
          data: { rejectionReason }
        }
      });

      await logActivity(
        admin.id,
        'REJECT_VENDOR_NIN',
        'USER',
        vendorIdstr,
        { status: 'REJECTED', rejectionReason },
        req
      );

      sendSuccessResponse(res, "Vendor NIN rejected");
    } else {
      throw new BadRequestError("Invalid status. Must be VERIFIED or REJECTED");
    }
  } catch (error) {
    next(error);
  }
};


export const getPendingNINVerifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const admin = req.user as any;

    if (admin.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view pending verifications");
    }

    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {
      role: Role.VENDOR,
      ninVerificationStatus: VerificationStatus.PENDING
    };

    const [vendors, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatar: true,
          location: true,
          ninPhotoUrl: true,
          ninVerificationStatus: true,
          createdAt: true,
          documents: {
            where: { type: 'NIN' },
            select: {
              id: true,
              name: true,
              url: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.user.count({ where })
    ]);

    sendSuccessResponse(res, "Pending NIN verifications retrieved", {
      vendors,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};


export const uploadNIN = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const file = req.file as any;

    if (user.role !== Role.VENDOR) {
      throw new ForbiddenError("Only vendors can upload NIN");
    }

    if (!file) {
      throw new BadRequestError("NIN photo file is required");
    }

    // Upload logic handled by multer, just update database
    const ninPhotoUrl = process.env.STORAGE_DRIVER === 'azure'
      ? file.url
      : `/uploads/${file.filename}`;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ninPhotoUrl,
        ninVerificationStatus: VerificationStatus.PENDING,
        ninVerifiedAt: null,
        ninVerifiedBy: null,
        ninRejectionReason: null
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        ninPhotoUrl: true,
        ninVerificationStatus: true
      }
    });

    // Create NIN document record
    await prisma.document.create({
      data: {
        name: `NIN_${user.fullName.replace(/\s/g, '_')}`,
        type: 'NIN',
        url: ninPhotoUrl,
        key: ninPhotoUrl.split('/').pop() || '',
        size: file.size,
        mimeType: file.mimetype,
        container: STORAGE_CONTAINERS.NIN_DOCUMENTS,
        vendorId: user.id,
        uploadedById: user.id
      }
    });

    await logActivity(
      user.id,
      'UPLOAD_NIN',
      'USER',
      user.id,
      { status: 'PENDING' },
      req
    );

    sendSuccessResponse(res, "NIN uploaded successfully. Awaiting admin verification.", updatedUser);
  } catch (error) {
    next(error);
  }
};