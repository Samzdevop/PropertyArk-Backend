import { Router } from 'express';
import {
  createDiagnosis,
  updateDiagnosis,
  getLivestockDiagnoses,
  getDiagnosis,
  deleteDiagnosis
} from '../contollers/diagnosis.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createDiagnosisSchema,
  updateDiagnosisSchema,
} from '../schemas/diagnosis.schemas';

export const diagnosisRouter = Router();

// Create diagnosis - VET only
diagnosisRouter.post(
  '/:livestockId',
  authenticateJWT,
  validateRequest(createDiagnosisSchema),
  createDiagnosis
);

// Update diagnosis - VET only
diagnosisRouter.put(
  '/:diagnosisId',
  authenticateJWT,
  validateRequest(updateDiagnosisSchema),
  updateDiagnosis
);

// Get all diagnoses for a livestock
diagnosisRouter.get(
  '/livestock/:livestockId',
  authenticateJWT,
  getLivestockDiagnoses
);

// Get single diagnosis
diagnosisRouter.get(
  '/:diagnosisId',
  authenticateJWT,
  getDiagnosis
);

// Delete diagnosis - VET only
diagnosisRouter.delete(
  '/:diagnosisId',
  authenticateJWT,
  deleteDiagnosis
);