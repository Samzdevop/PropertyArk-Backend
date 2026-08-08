import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { getAdminDashboardOverview, getNINStats, getPlatformOverview, getPropertyManagementStats } from "../contollers/adminDashboard.controller";
import { propertyManagementStatsSchema } from "../schemas/admindashboard.schemas";


export const adminDashboardRouter = Router();


adminDashboardRouter.get(
  '/nin-stats',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getNINStats
);

// Property management statistics
adminDashboardRouter.get(
  '/property-stats',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(propertyManagementStatsSchema),
  getPropertyManagementStats
);

// Admin dashboard overview
adminDashboardRouter.get(
  '/dashboard',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getAdminDashboardOverview
);

// Platform overview
adminDashboardRouter.get(
  '/platform-overview',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getPlatformOverview
);