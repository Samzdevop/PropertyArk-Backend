import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import {
  createContact,
  getAllContacts,
  getContactById,
  deleteContact,
} from "../contollers/contact.controller";
import { createContactSchema, getContactsQuerySchema } from "../schemas/contact.schemas";

export const contactRouter = Router();


contactRouter.post(
  '/',
  validateRequest(createContactSchema),
  createContact
);


contactRouter.get(
  '/',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(getContactsQuerySchema),
  getAllContacts
);

contactRouter.get(
  '/:id',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getContactById
);

contactRouter.delete(
  '/:id',
  authenticateJWT,
  requireRoles(['ADMIN']),
  deleteContact
);