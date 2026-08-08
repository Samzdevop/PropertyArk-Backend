import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { addAvailability, deleteAvailabilitySlot, getAvailability, getAvailableSlotsForDate, getVendorDashboardStats, setAvailability, toggleAvailabilitySlot, updateAvailabilitySlot } from "../contollers/vendor.controller";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { addAvailabilitySchema, getAvailabilitySchema, getAvailableSlotsSchema, setAvailabilitySchema } from "../schemas/vendor.schemas";

export const vendorRouter = Router();


vendorRouter.get(
  '/stats',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  getVendorDashboardStats
);


vendorRouter.post(
  '/availability',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  validateRequest(setAvailabilitySchema),
  setAvailability
);


vendorRouter.post(
  '/availability/single',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  validateRequest(addAvailabilitySchema),
  addAvailability
);
vendorRouter.get(
  '/availability',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  validateRequest(getAvailabilitySchema),
  getAvailability
);


vendorRouter.get(
  '/availability/vendor/:vendorId/slots',
  validateRequest(getAvailableSlotsSchema),
  getAvailableSlotsForDate
);

// Update availability slot
vendorRouter.patch(
  '/availability/:slotId',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  updateAvailabilitySlot
);

// Delete availability slot
vendorRouter.delete(
  '/availability/:slotId',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  deleteAvailabilitySlot
);

// Toggle availability slot
vendorRouter.patch(
  '/availability/:slotId/toggle',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  toggleAvailabilitySlot
);