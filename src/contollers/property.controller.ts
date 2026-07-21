import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { PropertyService } from "../services/property.service";
import { MediaService } from "../services/media.service";
import { attachBaseUrlUploads } from "../utils/attachBaseUrl.utils";
import { Role, PropertyListingStatus, VerificationStatus } from "@prisma/client";
import { ForbiddenError } from "../errors/ForbiddenError";
import { NotFoundError } from "../errors/NotFoundError";
import { BadRequestError } from "../errors/BadRequestError";
import { serializeDates } from "../utils/serialize.utils";
import { logActivity } from "./activity.controller";
import { ViewTrackingService } from "../services/viewTracking.service";


export const createProperty = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (user.role === Role.VENDOR) {
      const vendor = await prisma.user.findUnique({
        where: { id: user.id },
        select: { ninVerificationStatus: true }
      });

      if (!vendor || vendor.ninVerificationStatus !== VerificationStatus.VERIFIED) {
        throw new ForbiddenError("Your NIN must be verified by admin before you can list properties");
      }
    }

    const property = await PropertyService.createProperty(
      user.id,
      user.role,
      req.body,
      files
    );

    await logActivity(
      user.id,
      'CREATE_PROPERTY',
      'PROPERTY',
      property.id,
      { propertyName: property.name, listingStatus: PropertyListingStatus.PENDING },
      req
    );

    sendSuccessResponse(
      res,
      "Property created successfully and is pending admin approval.",
      property,
      201
    );
  } catch (error) {
    next(error);
  }
};


export const getAllProperties = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    const result = await PropertyService.getAllProperties(
      user.id,
      user.role,
      req.query
    );

    sendSuccessResponse(res, "Properties retrieved successfully", {
      properties: attachBaseUrlUploads(serializeDates(result.properties), req),
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};


export const getPropertyById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    const property = await PropertyService.getPropertyById(
      user.id,
      user.role,
      id as string
    );

    setImmediate(() => {
      ViewTrackingService.trackView(id as string, user.id).catch(error => {
        console.error('View tracking error:', error);
      });
    });

    await logActivity(
      user.id,
      'VIEW_PROPERTY',
      'PROPERTY',
      property.id,
      { propertyName: property.name },
      req
    );

    const propertyWithBaseUrls = attachBaseUrlUploads(serializeDates(property), req);
    sendSuccessResponse(res, "Property retrieved successfully", propertyWithBaseUrls);
  } catch (error) {
    next(error);
  }
};


export const updateProperty = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const updatedProperty = await PropertyService.updateProperty(
      user.id,
      user.role,
      id as string,
      req.body,
      files
    );

    await logActivity(
      user.id,
      'UPDATE_PROPERTY',
      'PROPERTY',
      id as string,
      { updates: Object.keys(req.body) },
      req
    );

    sendSuccessResponse(res, "Property updated successfully", updatedProperty);
  } catch (error) {
    next(error);
  }
};


export const deleteProperty = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    await PropertyService.deleteProperty(user.id, user.role, id as string);

    await logActivity(
      user.id,
      'DELETE_PROPERTY',
      'PROPERTY',
      id as string,
      {},
      req
    );

    sendSuccessResponse(res, "Property deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const reviewProperty = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can review properties");
    }

    if (!status || (status !== 'accept' && status !== 'reject')) {
      throw new BadRequestError("Status must be either 'accept' or 'reject'");
    }

    // If rejecting, rejection reason is required
    if (status === 'reject' && !rejectionReason) {
      throw new BadRequestError("Rejection reason is required when rejecting a property");
    }

    const property = await prisma.property.findUnique({
      where: { id: id as string },
      include: {
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (property.listingStatus !== PropertyListingStatus.PENDING) {
      throw new ForbiddenError("Property is not in pending status");
    }

    const isApproved = status === 'accept';
    const updateData: any = {
      listingStatus: isApproved ? PropertyListingStatus.ACTIVE : PropertyListingStatus.REJECTED,
      reviewedBy: user.id,
      reviewedAt: new Date()
    };

    if (!isApproved) {
      updateData.rejectionReason = rejectionReason;
    }

    const updatedProperty = await prisma.property.update({
      where: { id: id as string },
      data: updateData,
      include: {
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            employeeId: true,
            department: true
          }
        },
        media: true
      }
    });

    // Create notification for vendor
    const notificationType = isApproved ? 'PROPERTY_APPROVED' : 'PROPERTY_REJECTED';
    const notificationTitle = isApproved ? 'Property Approved' : 'Property Rejected';
    const notificationMessage = isApproved
      ? `Your property "${property.name}" has been approved and is now live.`
      : `Your property "${property.name}" was rejected. Reason: ${rejectionReason}`;

    await prisma.notification.create({
      data: {
        userId: property.vendorId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        data: {
          propertyId: property.id,
          ...(rejectionReason && { rejectionReason })
        }
      }
    });

    await logActivity(
      user.id,
      isApproved ? 'APPROVE_PROPERTY' : 'REJECT_PROPERTY',
      'PROPERTY',
      id as string,
      {
        propertyName: property.name,
        status,
        ...(rejectionReason && { rejectionReason })
      },
      req
    );

    sendSuccessResponse(
      res,
      isApproved ? "Property approved successfully" : "Property rejected successfully",
      updatedProperty
    );
  } catch (error) {
    next(error);
  }
};


export const getAvailableProperties = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type,
      listingType,
      city,
      state,
      bedrooms,
      minPrice,
      maxPrice,
      page = 1,
      limit = 12
    } = req.query;

    const result = await PropertyService.getAvailableProperties({
      type: type as string,
      listingType: listingType as string,
      city: city as string,
      state: state as string,
      bedrooms: bedrooms as string,
      minPrice: minPrice as string,
      maxPrice: maxPrice as string,
      page: Number(page),
      limit: Number(limit)
    });

    sendSuccessResponse(res, "Available properties retrieved successfully", {
      properties: attachBaseUrlUploads(serializeDates(result.properties), req),
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};


export const getPublicPropertyById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const property = await PropertyService.getPublicPropertyById(id as string);

    const userId = (req.user as any)?.id;
    setImmediate(() => {
      ViewTrackingService.trackView(id as string, userId).catch(error => {
        console.error('View tracking error:', error);
      });
    });

    const propertyWithBaseUrls = attachBaseUrlUploads(serializeDates(property), req);

    sendSuccessResponse(res, "Property retrieved successfully", propertyWithBaseUrls);
  } catch (error) {
    next(error);
  }
};


export const uploadPropertyMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const { result, savedMedia, mediaDataLength } = await MediaService.uploadPropertyMedia(
      user.id,
      user.role,
      id as string,
      files
    );

    await logActivity(
      user.id,
      'UPLOAD_PROPERTY_MEDIA',
      'PROPERTY',
      id as string,
      { mediaCount: mediaDataLength },
      req
    );

    sendSuccessResponse(res, `Successfully uploaded ${mediaDataLength} file(s)`, {
      propertyId: id,
      uploadedCount: result.count,
      uploadedFiles: savedMedia.map((m: any) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        url: m.url,
        size: m.size,
        mimeType: m.mimeType,
        isPrimary: m.isPrimary
      }))
    });
  } catch (error) {
    next(error);
  }
};



export const deleteMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const user = req.user as any;

    await MediaService.deleteMedia(user.id, user.role, mediaId as string);

    await logActivity(
      user.id,
      'DELETE_MEDIA',
      'MEDIA',
      mediaId as string,
      {},
      req
    );

    sendSuccessResponse(res, "Media deleted successfully");
  } catch (error) {
    next(error);
  }
};


export const setPrimaryMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const user = req.user as any;

    const updatedMedia = await MediaService.setPrimaryMedia(
      user.id,
      user.role,
      mediaId as string
    );

    await logActivity(
      user.id,
      'SET_PRIMARY_MEDIA',
      'MEDIA',
      mediaId as string,
      {},
      req
    );

    sendSuccessResponse(res, "Primary media set successfully", updatedMedia);
  } catch (error) {
    next(error);
  }
};


export const getPropertyMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const { type } = req.query;

    const media = await MediaService.getPropertyMedia(
      user.id,
      user.role,
      id as string,
      type as string
    );

    sendSuccessResponse(res, "Property media retrieved successfully", media);
  } catch (error) {
    next(error);
  }
};



export const bulkDeleteMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { mediaIds } = req.body;
    const user = req.user as any;

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      throw new BadRequestError("mediaIds array is required");
    }

    const result = await MediaService.bulkDeleteMedia(
      user.id,
      user.role,
      id as string,
      mediaIds
    );

    await logActivity(
      user.id,
      'BULK_DELETE_MEDIA',
      'PROPERTY',
      id as string,
      { deletedCount: result.deletedCount },
      req
    );

    sendSuccessResponse(res, "Media deleted successfully", result);
  } catch (error) {
    next(error);
  }
};


export const getMediaById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const user = req.user as any;

    const media = await MediaService.getMediaById(
      user.id,
      user.role,
      mediaId as string
    );

    sendSuccessResponse(res, "Media retrieved successfully", media);
  } catch (error) {
    next(error);
  }
};


export const updateMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const { name } = req.body;
    const user = req.user as any;

    if (!name) {
      throw new BadRequestError("Name is required");
    }

    const updatedMedia = await MediaService.updateMedia(
      user.id,
      user.role,
      mediaId as string,
      { name }
    );

    await logActivity(
      user.id,
      'UPDATE_MEDIA',
      'MEDIA',
      mediaId as string,
      { newName: name },
      req
    );

    sendSuccessResponse(res, "Media updated successfully", updatedMedia);
  } catch (error) {
    next(error);
  }
};


export const getPropertyMediaStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    const stats = await MediaService.getPropertyMediaStats(
      user.id,
      user.role,
      id as string
    );

    sendSuccessResponse(res, "Property media stats retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};