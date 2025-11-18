import { Router } from 'express';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { getNotifications, updateNotificationStatus } from '../contollers/notification.controller';
import { updateNotificationStatusSchema } from '../schemas/treatment.schemas';

export const notificationRouter = Router();

// Create diagnosis - VET only
notificationRouter.get(
  '/',
  authenticateJWT,
  getNotifications
);
notificationRouter.patch(
  '/notifications/:notificationId/status',
  authenticateJWT,
  validateRequest(updateNotificationStatusSchema),
  updateNotificationStatus
);