import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { deleteNotification, getBulkNotificationDetails, getMyNotifications, getNotificationStats, markAllAsRead, markAsRead, sendBulkNotification, sendToUser } from "../contollers/notification.controller";
import { deleteNotificationSchema, getBulkDetailsSchema, getNotificationsSchema, markAsReadSchema, sendBulkSchema, sendToUserSchema } from "../schemas/notification.schemas";

export const notificationRouter = Router();

// Admin only routes
notificationRouter.post(
  '/admin/send-user',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(sendToUserSchema),
  sendToUser
);

notificationRouter.post(
  '/admin/send-bulk',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(sendBulkSchema),
  sendBulkNotification
);

notificationRouter.get(
  '/admin/stats',
  authenticateJWT,
  requireRoles(['ADMIN']),
  getNotificationStats
);

notificationRouter.get(
  '/admin/bulk/:bulkId',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(getBulkDetailsSchema),
  getBulkNotificationDetails
);

// User routes
notificationRouter.get(
  '/my',
  authenticateJWT,
  validateRequest(getNotificationsSchema),
  getMyNotifications
);

notificationRouter.patch(
  '/:notificationId/read',
  authenticateJWT,
  validateRequest(markAsReadSchema),
  markAsRead
);

notificationRouter.patch(
  '/read/all',
  authenticateJWT,
  markAllAsRead
);

notificationRouter.delete(
  '/:notificationId',
  authenticateJWT,
  validateRequest(deleteNotificationSchema),
  deleteNotification
);