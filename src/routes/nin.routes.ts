import { Router } from "express";
import { uploadNIN as uploadNINMiddleware } from "../config/upload";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { getPendingNINVerifications, uploadNIN, verifyVendorNIN } from "../contollers/nin.controller";
import { verifyNINSchema } from "../schemas/nin.schemas";
import { validateRequest } from "../middlewares/validateRequest.middleware";


export const ninRouter = Router();


ninRouter.post(
  '/upload',
  authenticateJWT,
  requireRoles(['VENDOR']),
  uploadNINMiddleware.single('ninPhoto'),
  uploadNIN
);


ninRouter.get(
  '/pending',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getPendingNINVerifications
);


ninRouter.patch(
  '/:vendorId/verify',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(verifyNINSchema),
  verifyVendorNIN
);