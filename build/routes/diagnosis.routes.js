"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosisRouter = void 0;
const express_1 = require("express");
const diagnosis_controller_1 = require("../contollers/diagnosis.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const diagnosis_schemas_1 = require("../schemas/diagnosis.schemas");
exports.diagnosisRouter = (0, express_1.Router)();
// Create diagnosis - VET only
exports.diagnosisRouter.post('/:livestockId', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(diagnosis_schemas_1.createDiagnosisSchema), diagnosis_controller_1.createDiagnosis);
// Update diagnosis - VET only
exports.diagnosisRouter.put('/:diagnosisId', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(diagnosis_schemas_1.updateDiagnosisSchema), diagnosis_controller_1.updateDiagnosis);
// Get all diagnoses for a livestock
exports.diagnosisRouter.get('/livestock/:livestockId', errorHandler_1.authenticateJWT, diagnosis_controller_1.getLivestockDiagnoses);
// Get single diagnosis
exports.diagnosisRouter.get('/:diagnosisId', errorHandler_1.authenticateJWT, diagnosis_controller_1.getDiagnosis);
// Delete diagnosis - VET only
exports.diagnosisRouter.delete('/:diagnosisId', errorHandler_1.authenticateJWT, diagnosis_controller_1.deleteDiagnosis);
