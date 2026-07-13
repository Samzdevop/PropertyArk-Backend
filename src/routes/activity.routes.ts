import { Router } from 'express';
import { authenticateJWT } from '../middlewares/errorHandler.middleware';
import { requireRoles } from '../middlewares/roleCheck.middleware';
import { validateRequest } from '../middlewares/validateRequest.middleware';
import {
  getAllActivities,
  getActivityById,
  getUserActivities,
  getEntityActivities,
  getActivityStats,
  getMyActivitySummary,
  getVendorActivitySummary,
  getAdminDashboardSummary,
  cleanupActivities
} from '../contollers/activity.controller';
import {
  getAllActivitiesSchema,
  getActivityByIdSchema,
  getUserActivitiesSchema,
  getEntityActivitiesSchema,
  activityStatsSchema,
  cleanupActivitiesSchema,
  vendorActivitySummarySchema
} from '../schemas/activity.schemas';

export const activityRouter = Router();


activityRouter.get(
  '/',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(getAllActivitiesSchema),
  getAllActivities
);


activityRouter.get(
  '/stats',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(activityStatsSchema),
  getActivityStats
);


activityRouter.get(
  '/my-summary',
  authenticateJWT,
  getMyActivitySummary
);


activityRouter.get(
  '/admin-dashboard',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getAdminDashboardSummary
);


activityRouter.get(
  '/vendor/:vendorId/summary',
  authenticateJWT,
  validateRequest(vendorActivitySummarySchema),
  getVendorActivitySummary
);


activityRouter.get(
  '/:id',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(getActivityByIdSchema),
  getActivityById
);


activityRouter.get(
  '/user/:userId',
  authenticateJWT,
  validateRequest(getUserActivitiesSchema),
  getUserActivities
);


activityRouter.get(
  '/entity/:entityType/:entityId',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(getEntityActivitiesSchema),
  getEntityActivities
);


activityRouter.delete(
  '/cleanup',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(cleanupActivitiesSchema),
  cleanupActivities
);