// routes/inquiry.routes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import {
  createInquiry,
  getVendorInquiries,
  getUserInquiries,
  getInquiryById,
  reviewInquiry,
  getInquiryStats,
  getAdminInquiryStats
} from "../contollers/inquiry.controller";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import {
  createInquirySchema,
  reviewInquirySchema,
  getInquiriesQuerySchema
} from "../schemas/inquiry.schemas";

export const inquiryRouter = Router();


inquiryRouter.post(
  '/',
  authenticateJWT,
  requireRoles(['USER']),
  validateRequest(createInquirySchema),
  createInquiry
);

inquiryRouter.get(
  '/admin/stats',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getAdminInquiryStats
);

// Get vendor inquiries (Vendor/Admin only)
inquiryRouter.get(
  '/vendor',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  validateRequest(getInquiriesQuerySchema),
  getVendorInquiries
);

// Get inquiry stats (Vendor/Admin only)
inquiryRouter.get(
  '/vendor/stats',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  getInquiryStats
);


// Get user inquiries
inquiryRouter.get(
  '/my',
  authenticateJWT,
  requireRoles(['USER']),
  validateRequest(getInquiriesQuerySchema),
  getUserInquiries
);

// Get inquiry by ID
inquiryRouter.get(
  '/:id',
  authenticateJWT,
  getInquiryById
);

// Review inquiry (accept/decline)
inquiryRouter.patch(
  '/:id/review',
  authenticateJWT,
  requireRoles(['VENDOR']),
  validateRequest(reviewInquirySchema),
  reviewInquiry
);