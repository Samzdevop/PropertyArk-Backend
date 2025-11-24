import { Router } from 'express';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { getNotifications, getNotificationSettings, toggleNotificationSetting, updateNotificationSettings, updateNotificationStatus } from '../contollers/notification.controller';
import { updateNotificationStatusSchema } from '../schemas/treatment.schemas';
import { updateNotificationSettingsSchema } from '../schemas/notification.schemas';

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