import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import {
  subscribe,
  getAllSubscribers,
  unsubscribeByToken,
  unsubscribeByEmail,
  deleteSubscriber,
} from "../contollers/newsletter.controller";
import { getSubscribersQuerySchema, subscribeSchema, unsubscribeByEmailSchema } from "../schemas/newsletter.schemas";


export const newsletterRouter = Router();


newsletterRouter.post(
  '/subscribe',
  validateRequest(subscribeSchema),
  subscribe
);


newsletterRouter.get(
  '/unsubscribe',
  unsubscribeByToken
);

newsletterRouter.post(
  '/unsubscribe',
  validateRequest(unsubscribeByEmailSchema),
  unsubscribeByEmail
);


newsletterRouter.get(
  '/subscribers',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(getSubscribersQuerySchema),
  getAllSubscribers
);

newsletterRouter.delete(
  '/subscribers/:id',
  authenticateJWT,
  requireRoles(['ADMIN']),
  deleteSubscriber
);