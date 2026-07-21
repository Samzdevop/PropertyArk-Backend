import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import {
  getVendorViewStats,
  getPropertyViewStats,
  getDashboardViewSummary
} from "../contollers/viewStats.controller";

export const viewStatsRouter = Router();

viewStatsRouter.get(
  '/vendor',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  getVendorViewStats
);


viewStatsRouter.get(
  '/vendor/dashboard',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  getDashboardViewSummary
);


viewStatsRouter.get(
  '/property/:propertyId',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  getPropertyViewStats
);