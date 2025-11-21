"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentRouter = void 0;
// src/routes/appointment.routes.ts
const express_1 = require("express");
const appointment_controller_1 = require("../contollers/appointment.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const appointment_schemas_1 = require("../schemas/appointment.schemas");
exports.appointmentRouter = (0, express_1.Router)();
// Schedule appointment - VET only
exports.appointmentRouter.post('/:companyId/schedule', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(appointment_schemas_1.scheduleAppointmentSchema), appointment_controller_1.scheduleAppointment);
// Get appointments
exports.appointmentRouter.get('/', errorHandler_1.authenticateJWT, appointment_controller_1.getAppointments);
// Log farm visit - VET only
exports.appointmentRouter.post('/:companyId/farm-visits', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(appointment_schemas_1.logFarmVisitSchema), appointment_controller_1.logFarmVisit);
// Get farm visits for a company
exports.appointmentRouter.get('/companies/:companyId/farm-visits', errorHandler_1.authenticateJWT, appointment_controller_1.getFarmVisits);
