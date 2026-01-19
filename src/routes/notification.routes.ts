import { Router } from 'express';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { getNotifications, getNotificationSettings, requestHealthStatusUpdate, requestWeightUpdate, toggleNotificationSetting, updateNotificationSettings, updateNotificationStatus } from '../contollers/notification.controller';
import { updateNotificationStatusSchema } from '../schemas/treatment.schemas';
import { requestUpdateSchema, updateNotificationSettingsSchema } from '../schemas/notification.schemas';
import { requireRoles } from '../middlewares/roleCheck';

export const notificationRouter = Router();

// Create diagnosis - VET only
notificationRouter.get(
  '/',
  authenticateJWT,
  getNotifications
);
notificationRouter.patch(
  '/:notificationId/status',
  authenticateJWT,
  validateRequest(updateNotificationStatusSchema),
  updateNotificationStatus
);


notificationRouter.get(
  '/all-notification',
  authenticateJWT,
  getNotificationSettings
);

notificationRouter.put(
  '/notification-settings',
  authenticateJWT,
  validateRequest(updateNotificationSettingsSchema),
  updateNotificationSettings
);


notificationRouter.patch(
  '/:settingType/toggle',
  authenticateJWT,
  toggleNotificationSetting
);

notificationRouter.post(
  '/:livestockId/weight-update',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(requestUpdateSchema),
  requestWeightUpdate
);

notificationRouter.post(
  '/:livestockId/request-health-update',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER', 'COWORKER', 'VET']),
  validateRequest(requestUpdateSchema),
  requestHealthStatusUpdate
);
