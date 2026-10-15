
import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { upload } from "../config/upload";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import {
  createProfessionalServiceSchema,
  getProfessionalServicesQuerySchema,
} from "../schemas/professionalService.schemas";
import { createRequest, deleteRequest, getAllRequests, getRequestById } from "@/contollers/professionalService.controller";

export const professionalServiceRouter = Router();



professionalServiceRouter.post(
  '/',
  upload.array('documents', 10),
  validateRequest(createProfessionalServiceSchema),
  createRequest
);


professionalServiceRouter.get(
  '/:id',
  getRequestById
);


professionalServiceRouter.get(
  '/',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(getProfessionalServicesQuerySchema),
  getAllRequests
);

professionalServiceRouter.delete(
  '/:id',
  authenticateJWT,
  requireRoles(['ADMIN']),
  deleteRequest
);