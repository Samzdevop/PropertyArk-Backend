import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { CreditPointService } from "../services/creditPoint.service";
import { CreditPurchaseService } from "../services/creditPurchase.service";
import { PaystackService } from "../services/paystack.service";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { BadRequestError } from "../errors/BadRequestError";
import { Role } from "@prisma/client";


export const getSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view credit point settings");
    }

    const settings = await CreditPointService.getSettings();

    sendSuccessResponse(res, "Credit point settings retrieved successfully", settings);
  } catch (error) {
    next(error);
  }
};


export const updateSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const {
      newVendorBonusPoints,
      newVendorBonusExpiryDays,
      propertyCreationCost,
      featurePropertyCost,
      featurePropertyDurationDays,
      minimumPurchasePoints,
      pricePerPoint,
      currency
    } = req.body;

    const settings = await CreditPointService.updateSettings(user.id, {
      newVendorBonusPoints,
      newVendorBonusExpiryDays,
      propertyCreationCost,
      featurePropertyCost,
      featurePropertyDurationDays,
      minimumPurchasePoints,
      pricePerPoint,
      currency
    });

    await logActivity(
      user.id,
      'UPDATE_CREDIT_SETTINGS',
      'CREDIT_POINT',
      settings.id,
      {
        propertyCreationCost,
        featurePropertyCost,
        minimumPurchasePoints,
        pricePerPoint
      },
      req
    );

    sendSuccessResponse(res, "Credit point settings updated successfully", settings);
  } catch (error) {
    next(error);
  }
};


export const getMyCreditInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { page = 1, limit = 20 } = req.query;

    const result = await CreditPointService.getUserCreditInfo(
      user.id,
      Number(page),
      Number(limit)
    );

    sendSuccessResponse(res, "Credit info retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};


export const calculatePurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { points } = req.query;

    if (!points) {
      throw new BadRequestError("Points parameter is required");
    }

    const calculation = await CreditPointService.calculatePurchaseAmount(Number(points));

    sendSuccessResponse(res, "Purchase amount calculated successfully", calculation);
  } catch (error) {
    next(error);
  }
};


export const initializePurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { points } = req.body;

    if (!points || points <= 0) {
      throw new BadRequestError("Points must be greater than 0");
    }

    const result = await CreditPurchaseService.initializePurchase(user.id, points);

    await logActivity(
      user.id,
      'INITIALIZE_CREDIT_PURCHASE',
      'CREDIT_POINT',
      result.purchaseId,
      {
        points,
        amount: result.amount,
        reference: result.reference
      },
      req
    );

    sendSuccessResponse(res, "Purchase initialized successfully", result);
  } catch (error) {
    next(error);
  }
};


export const verifyPurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reference } = req.params;

    if (!reference) {
      throw new BadRequestError("Reference is required");
    }

    const result = await CreditPurchaseService.verifyPurchase(reference as string);

    sendSuccessResponse(res, "Purchase verified successfully", result);
  } catch (error) {
    next(error);
  }
};


export const paystackWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    
    if (!signature) {
      throw new BadRequestError("Missing signature");
    }

    const payload = JSON.stringify(req.body);
    
    if (!PaystackService.validateWebhookSignature(payload, signature)) {
      throw new BadRequestError("Invalid signature");
    }

    const result = await CreditPurchaseService.handleWebhook(req.body);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};


export const featureProperty = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { propertyId } = req.params;

    const property = await CreditPointService.featureProperty(
      propertyId as string,
      user.id
    );

    await logActivity(
      user.id,
      'FEATURE_PROPERTY',
      'PROPERTY',
      propertyId as string,
      {
        propertyName: property.name,
        featuredUntil: property.featuredUntil
      },
      req
    );

    sendSuccessResponse(res, "Property featured successfully", property);
  } catch (error) {
    next(error);
  }
};


export const unfeatureProperty = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { propertyId } = req.params;

    const property = await CreditPointService.unfeatureProperty(
      propertyId as string,
      user.id
    );

    await logActivity(
      user.id,
      'UNFEATURE_PROPERTY',
      'PROPERTY',
      propertyId as string,
      {
        propertyName: property.name
      },
      req
    );

    sendSuccessResponse(res, "Property unfeatured successfully", property);
  } catch (error) {
    next(error);
  }
};


export const getFeaturedProperties = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const properties = await CreditPointService.getFeaturedProperties();

    sendSuccessResponse(res, "Featured properties retrieved successfully", properties);
  } catch (error) {
    next(error);
  }
};


export const cleanupExpiredFeatured = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can cleanup expired featured properties");
    }

    const count = await CreditPointService.cleanupExpiredFeatured();

    await logActivity(
      user.id,
      'CLEANUP_EXPIRED_FEATURED',
      'PROPERTY',
      'cleanup',
      { count },
      req
    );

    sendSuccessResponse(res, `Cleaned up ${count} expired featured properties`, { count });
  } catch (error) {
    next(error);
  }
};