import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { ProfessionalServiceService } from "../services/professionalService.service";
import { logActivity } from "./activity.controller";
import { BadRequestError } from "../errors/BadRequestError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role, ContactStatus, ServiceType } from "@prisma/client";

export const createRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const files = req.files as Express.Multer.File[];
    const {
      fullName, email, phone, serviceType, consultationDate,
      propertyReference, message
    } = req.body;

    const request = await ProfessionalServiceService.createRequest(
      user?.id || null,
      { fullName, email, phone, serviceType, consultationDate, propertyReference, message },
      files
    );

    await logActivity(
      user?.id || 'anonymous',
      'CREATE_PROFESSIONAL_SERVICE_REQUEST',
      'PROFESSIONAL_SERVICE',
      request.id,
      {
        requestNumber: request.requestNumber,
        serviceType,
        documentCount: files?.length || 0,
      },
      req
    );

    sendSuccessResponse(
      res,
      "Your request has been submitted. Our team will contact you shortly.",
      { request },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getAllRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view all requests");
    }

    const { status, serviceType, page = 1, limit = 20, search } = req.query;

    const result = await ProfessionalServiceService.getAllRequests({
      status: status as ContactStatus,
      serviceType: serviceType as ServiceType,
      page: Number(page),
      limit: Number(limit),
      search: search as string,
    });

    await logActivity(
      user.id,
      'VIEW_PROFESSIONAL_SERVICE_REQUESTS',
      'PROFESSIONAL_SERVICE',
      'list',
      { total: result.pagination.total, filters: { status, serviceType } },
      req
    );

    sendSuccessResponse(res, "Requests retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getRequestById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    const request = await ProfessionalServiceService.getRequestById(
      id as string,
      user?.id || null,
      user?.role || 'USER'
    );

    await logActivity(
      user?.id || 'anonymous',
      'VIEW_PROFESSIONAL_SERVICE_REQUEST',
      'PROFESSIONAL_SERVICE',
      id as string,
      { requestNumber: request.requestNumber },
      req
    );

    sendSuccessResponse(res, "Request retrieved successfully", request);
  } catch (error) {
    next(error);
  }
};

export const deleteRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can delete requests");
    }

    await ProfessionalServiceService.deleteRequest(id as string, user.id);

    await logActivity(
      user.id,
      'DELETE_PROFESSIONAL_SERVICE_REQUEST',
      'PROFESSIONAL_SERVICE',
      id as string,
      {},
      req
    );

    sendSuccessResponse(res, "Request deleted successfully");
  } catch (error) {
    next(error);
  }
};