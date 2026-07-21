// routes/vendorDashboard.routes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { getVendorDashboardStats } from "../contollers/vendor.controller";

export const vendorRouter = Router();


vendorRouter.get(
  '/stats',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  getVendorDashboardStats
);