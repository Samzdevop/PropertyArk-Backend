import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { InquiryService } from "../services/inquiry.service";
import { logActivity } from "./activity.controller";
import { BadRequestError } from "../errors/BadRequestError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role } from "@prisma/client";


export const createInquiry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { propertyId, name, location, message, meetingType, proposedDate  } = req.body;

    const inquiry = await InquiryService.createInquiry(user.id, {
      propertyId,
      name,
      location,
      message,
      meetingType,
      proposedDate
    });

    await logActivity(
      user.id,
      'CREATE_INQUIRY',
      'INQUIRY',
      inquiry.id,
      {
        propertyId,
        inquiryNumber: inquiry.inquiryNumber,
        meetingType
      },
      req
    );

    sendSuccessResponse(res, "Inquiry sent successfully", inquiry, 201);
  } catch (error) {
    next(error);
  }
};


export const getVendorInquiries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can view vendor inquiries");
    }

    const { status, propertyId, page = 1, limit = 20 } = req.query;

    const result = await InquiryService.getVendorInquiries(
      user.id,
      user.role,
      {
        status: status as any,
        propertyId: propertyId as string,
        page: Number(page),
        limit: Number(limit)
      }
    );

    await logActivity(
      user.id,
      'VIEW_VENDOR_INQUIRIES',
      'INQUIRY',
      'list',
      { filters: { status, propertyId }, role: user.role, total: result.pagination.total },
      req
    );

    sendSuccessResponse(res, "Vendor inquiries retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};


export const getAdminInquiryStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view admin inquiry statistics");
    }

    const stats = await InquiryService.getAdminInquiryStats();

    await logActivity(
      user.id,
      'VIEW_ADMIN_INQUIRY_STATS',
      'INQUIRY',
      'stats',
      {
        total: stats.stats.total,
        pending: stats.stats.pending,
        completed: stats.stats.completed,
        reported: stats.stats.reported
      },
      req
    );

    sendSuccessResponse(res, "Admin inquiry statistics retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};


export const getUserInquiries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { page = 1, limit = 20 } = req.query;

    const result = await InquiryService.getUserInquiries(
      user.id,
      Number(page),
      Number(limit)
    );

    await logActivity(
      user.id,
      'VIEW_USER_INQUIRIES',
      'INQUIRY',
      'list',
      { total: result.pagination.total },
      req
    );

    sendSuccessResponse(res, "Your inquiries retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get inquiry by ID
 */
export const getInquiryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    const inquiry = await InquiryService.getInquiryById(
      id as string,
      user.id,
      user.role
    );

    await logActivity(
      user.id,
      'VIEW_INQUIRY',
      'INQUIRY',
      id as string,
      { inquiryNumber: inquiry.inquiryNumber },
      req
    );

    sendSuccessResponse(res, "Inquiry retrieved successfully", inquiry);
  } catch (error) {
    next(error);
  }
};

/**
 * Review inquiry (accept/decline)
 */
export const reviewInquiry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const { status, reason } = req.body;

    if (!status || (status !== 'ACCEPTED' && status !== 'DECLINED')) {
      throw new BadRequestError("Status must be 'ACCEPTED' or 'DECLINED'");
    }

    const inquiry = await InquiryService.reviewInquiry(
      id as string,
      user.id,
      { status, reason }
    );

    await logActivity(
      user.id,
      status === 'ACCEPTED' ? 'ACCEPT_INQUIRY' : 'DECLINE_INQUIRY',
      'INQUIRY',
      id as string,
      {
        inquiryNumber: inquiry.inquiryNumber,
        status,
        ...(reason && { reason })
      },
      req
    );

    sendSuccessResponse(
      res,
      `Inquiry ${status.toLowerCase()} successfully`,
      inquiry
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get inquiry stats for vendor
 */
export const getInquiryStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.VENDOR && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only vendors and admins can view inquiry stats");
    }

    const stats = await InquiryService.getInquiryStats(user.id);

    await logActivity(
      user.id,
      'VIEW_INQUIRY_STATS',
      'INQUIRY',
      'stats',
      { total: stats.total },
      req
    );

    sendSuccessResponse(res, "Inquiry statistics retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};