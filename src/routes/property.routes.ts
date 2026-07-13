import { Router } from "express";
import { upload } from "../config/upload";
import {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  getAvailableProperties,
  getPublicPropertyById,
  uploadPropertyMedia,
  deleteMedia,
  setPrimaryMedia,
  getPropertyMedia,
  getPropertyMediaStats,
  getMediaById,
  updateMedia,
  bulkDeleteMedia,
  reviewProperty
} from "../contollers/property.controller";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { bulkDeleteMediaSchema, createPropertySchema, reviewPropertySchema, updateMediaSchema, updatePropertySchema } from "../schemas/property.schemas";

export const propertyRouter = Router();


propertyRouter.get(
  '/available', 
  getAvailableProperties
);

propertyRouter.get(
  '/public/:id', 
  getPublicPropertyById
);


propertyRouter.get(
  '/',
  authenticateJWT,
  getAllProperties
);

propertyRouter.get(
  '/:id',
  authenticateJWT,
  getPropertyById
);

propertyRouter.post(
  '/',
  authenticateJWT,
  requireRoles(['ADMIN', 'VENDOR', 'STAFF']),
  upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'documents', maxCount: 10 }
  ]),
  validateRequest(createPropertySchema),
  createProperty
);


propertyRouter.patch(
  '/:id',
  authenticateJWT,
  requireRoles(['ADMIN', 'VENDOR', 'STAFF']),
  upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'documents', maxCount: 10 }
  ]),
  validateRequest(updatePropertySchema),
  updateProperty
);

propertyRouter.patch(
  '/:id/review',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(reviewPropertySchema),
  reviewProperty
);


propertyRouter.delete(
  '/:id',
  authenticateJWT,
  requireRoles(['ADMIN', 'VENDOR', 'STAFF']),
  deleteProperty
);


propertyRouter.post(
  '/:id/media',
  authenticateJWT,
  requireRoles(['ADMIN', 'VENDOR', 'STAFF']),
  upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'documents', maxCount: 10 }
  ]),
  uploadPropertyMedia
);

propertyRouter.get(
  '/:id/media',
  authenticateJWT,
  getPropertyMedia
);

propertyRouter.get(
  '/:id/media/stats',
  authenticateJWT,
  getPropertyMediaStats
);

propertyRouter.get(
  '/media/:mediaId',
  authenticateJWT,
  getMediaById
);

propertyRouter.patch(
  '/media/:mediaId',
  authenticateJWT,
  requireRoles(['ADMIN', 'VENDOR', 'STAFF']),
  validateRequest(updateMediaSchema),
  updateMedia
);


propertyRouter.delete(
  '/media/:mediaId',
  authenticateJWT,
  requireRoles(['ADMIN', 'VENDOR', 'STAFF']),
  deleteMedia
);

propertyRouter.delete(
  '/:id/media/bulk',
  authenticateJWT,
  requireRoles(['ADMIN', 'VENDOR', 'STAFF']),
  validateRequest(bulkDeleteMediaSchema),
  bulkDeleteMedia
);

propertyRouter.patch(
  '/media/:mediaId/primary',
  authenticateJWT,
  requireRoles(['ADMIN', 'VENDOR', 'STAFF']),
  setPrimaryMedia
);