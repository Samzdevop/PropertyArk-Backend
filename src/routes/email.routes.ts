import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { z } from "zod";
import { getEmailStatus, testEmail } from "../contollers/email.controller";

const testEmailSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

export const emailRouter = Router();

emailRouter.post(
  '/test',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(testEmailSchema),
  testEmail
);


emailRouter.get(
  '/status',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getEmailStatus
);