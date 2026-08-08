"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const notification_controller_1 = require("../contollers/notification.controller");
const notification_schemas_1 = require("../schemas/notification.schemas");
exports.notificationRouter = (0, express_1.Router)();
// Admin only routes
exports.notificationRouter.post('/admin/send-user', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(notification_schemas_1.sendToUserSchema), notification_controller_1.sendToUser);
exports.notificationRouter.post('/admin/send-bulk', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(notification_schemas_1.sendBulkSchema), notification_controller_1.sendBulkNotification);
exports.notificationRouter.get('/admin/stats', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), notification_controller_1.getNotificationStats);
exports.notificationRouter.get('/admin/bulk/:bulkId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(notification_schemas_1.getBulkDetailsSchema), notification_controller_1.getBulkNotificationDetails);
// User routes
exports.notificationRouter.get('/my', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(notification_schemas_1.getNotificationsSchema), notification_controller_1.getMyNotifications);
exports.notificationRouter.patch('/:notificationId/read', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(notification_schemas_1.markAsReadSchema), notification_controller_1.markAsRead);
exports.notificationRouter.patch('/read/all', errorHandler_middleware_1.authenticateJWT, notification_controller_1.markAllAsRead);
exports.notificationRouter.delete('/:notificationId', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(notification_schemas_1.deleteNotificationSchema), notification_controller_1.deleteNotification);
