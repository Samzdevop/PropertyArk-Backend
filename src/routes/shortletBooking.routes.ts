import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { approveBooking, cancelBooking, checkInGuest, checkOutGuest, createBooking, getVendorBookingStats } from "../contollers/shortletBooking.controller";
import { bookingIdSchema, createBookingSchema } from "../schemas/shortlest.schemas";

export const shortletBookingRouter = Router();

shortletBookingRouter.post(
  '/',
  validateRequest(createBookingSchema),
  createBooking
);

// Get vendor booking stats (authenticated)
shortletBookingRouter.get(
  '/vendor-stats',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  getVendorBookingStats
);

// Approve booking (vendor only)
shortletBookingRouter.patch(
  '/:bookingId/approve',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  validateRequest(bookingIdSchema),
  approveBooking
);

// Check-in guest (vendor only)
shortletBookingRouter.patch(
  '/:bookingId/check-in',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  validateRequest(bookingIdSchema),
  checkInGuest
);

// Check-out guest (vendor only)
shortletBookingRouter.patch(
  '/:bookingId/check-out',
  authenticateJWT,
  requireRoles(['VENDOR', 'ADMIN']),
  validateRequest(bookingIdSchema),
  checkOutGuest
);

// Cancel booking
shortletBookingRouter.patch(
  '/:bookingId/cancel',
  validateRequest(bookingIdSchema),
  cancelBooking
);