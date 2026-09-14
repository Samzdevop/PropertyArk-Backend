import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { calculatePurchase, cleanupExpiredFeatured, featureProperty, getFeaturedProperties, getMyCreditInfo, getSettings, initializePurchase, paystackWebhook, unfeatureProperty, updateSettings, verifyPurchase } from "../contollers/creditPoint.controller";
import { calculatePurchaseSchema, initializePurchaseSchema, updateSettingsSchema } from "../schemas/creditPoint.schemas";

export const creditPointRouter = Router();

// Public routes
creditPointRouter.post(
  '/webhook/paystack',
  paystackWebhook
);

creditPointRouter.get(
  '/featured',
  getFeaturedProperties
);

// Vendor routes
creditPointRouter.get(
  '/my-credit',
  authenticateJWT,
  requireRoles(['VENDOR']),
  getMyCreditInfo
);

creditPointRouter.get(
  '/calculate-purchase',
  authenticateJWT,
  requireRoles(['VENDOR']),
  validateRequest(calculatePurchaseSchema),
  calculatePurchase
);

creditPointRouter.post(
  '/purchase/initialize',
  authenticateJWT,
  requireRoles(['VENDOR']),
  validateRequest(initializePurchaseSchema),
  initializePurchase
);

creditPointRouter.get(
  '/purchase/verify/:reference',
  verifyPurchase
);

creditPointRouter.patch(
  '/feature/:propertyId',
  authenticateJWT,
  requireRoles(['VENDOR']),
  featureProperty
);

// Admin routes
creditPointRouter.get(
  '/settings',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getSettings
);

creditPointRouter.patch(
  '/settings',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(updateSettingsSchema),
  updateSettings
);

creditPointRouter.patch(
  '/unfeature/:propertyId',
  authenticateJWT,
  requireRoles(['ADMIN']),
  unfeatureProperty
);

creditPointRouter.post(
  '/cleanup-expired',
  authenticateJWT,
  requireRoles(['ADMIN']),
  cleanupExpiredFeatured
);