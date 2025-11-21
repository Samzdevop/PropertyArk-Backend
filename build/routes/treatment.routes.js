"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.treatmentRouter = void 0;
const express_1 = require("express");
const treatment_controller_1 = require("../contollers/treatment.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const roleCheck_1 = require("../middlewares/roleCheck");
const validateRequest_1 = require("../middlewares/validateRequest");
const treatment_schemas_1 = require("../schemas/treatment.schemas");
exports.treatmentRouter = (0, express_1.Router)();
exports.treatmentRouter.get('/', errorHandler_1.authenticateJWT, treatment_controller_1.getAllTreatments);
exports.treatmentRouter.get('/:treatmentId', errorHandler_1.authenticateJWT, treatment_controller_1.getTreatmentById);
exports.treatmentRouter.post('/livestock/:livestockId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER', 'COWORKER', 'VET']), (0, validateRequest_1.validateRequest)(treatment_schemas_1.recordTreatmentSchema), treatment_controller_1.recordTreatment);
exports.treatmentRouter.post('/:livestockId/prescribe', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(treatment_schemas_1.prescribeTreatmentSchema), treatment_controller_1.prescribeTreatment);
// Schedule follow-up - VET only
exports.treatmentRouter.post('/follow-ups', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(treatment_schemas_1.scheduleFollowUpSchema), treatment_controller_1.scheduleFollowUp);
// treatmentRouter.get(
//   '/livestock/:livestockId/follow-ups',
//   authenticateJWT,
//   getFollowUps
// );
// // Update follow-up status
// treatmentRouter.patch(
//   '/follow-ups/:followUpId/status',
//   authenticateJWT,
//   updateFollowUpStatus
// );
// route for treatment linked to specific sickness
// treatmentRouter.post(
//   '/livestock/:livestockId/sickness/:sicknessId/treatment',
//   authenticateJWT,
//   requireRoles(['ADMIN', 'FARM_KEEPER', 'VET']),
//   validateRequest(recordTreatmentSchema),
//   recordTreatment
// );
