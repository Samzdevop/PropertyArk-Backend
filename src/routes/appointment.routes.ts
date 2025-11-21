// src/routes/appointment.routes.ts
import { Router } from 'express';
import {
  scheduleAppointment,
  logFarmVisit,
  getAppointments,
  getFarmVisits
} from '../contollers/appointment.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  scheduleAppointmentSchema,
  logFarmVisitSchema
} from '../schemas/appointment.schemas';
import { upload } from '../config/upload';

export const appointmentRouter = Router();

// Schedule appointment - VET only
appointmentRouter.post(
  '/:companyId/schedule',
  authenticateJWT,
  validateRequest(scheduleAppointmentSchema),
  scheduleAppointment
);

// Get appointments
appointmentRouter.get(
  '/',
  authenticateJWT,
  getAppointments
);

// Log farm visit - VET only
appointmentRouter.post(
  '/:companyId/farm-visits',
  authenticateJWT,
  validateRequest(logFarmVisitSchema),
  logFarmVisit
);

// Get farm visits for a company
appointmentRouter.get(
  '/companies/:companyId/farm-visits',
  authenticateJWT,
  getFarmVisits
);