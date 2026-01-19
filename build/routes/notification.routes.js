"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const notification_controller_1 = require("../contollers/notification.controller");
const treatment_schemas_1 = require("../schemas/treatment.schemas");
const notification_schemas_1 = require("../schemas/notification.schemas");
const roleCheck_1 = require("../middlewares/roleCheck");
exports.notificationRouter = (0, express_1.Router)();
// Create diagnosis - VET only
exports.notificationRouter.get('/', errorHandler_1.authenticateJWT, notification_controller_1.getNotifications);
exports.notificationRouter.patch('/:notificationId/status', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(treatment_schemas_1.updateNotificationStatusSchema), notification_controller_1.updateNotificationStatus);
exports.notificationRouter.get('/all-notification', errorHandler_1.authenticateJWT, notification_controller_1.getNotificationSettings);
exports.notificationRouter.put('/notification-settings', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(notification_schemas_1.updateNotificationSettingsSchema), notification_controller_1.updateNotificationSettings);
exports.notificationRouter.patch('/:settingType/toggle', errorHandler_1.authenticateJWT, notification_controller_1.toggleNotificationSetting);
exports.notificationRouter.post('/:livestockId/weight-update', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN']), (0, validateRequest_1.validateRequest)(notification_schemas_1.requestUpdateSchema), notification_controller_1.requestWeightUpdate);
exports.notificationRouter.post('/:livestockId/request-health-update', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER', 'COWORKER', 'VET']), (0, validateRequest_1.validateRequest)(notification_schemas_1.requestUpdateSchema), notification_controller_1.requestHealthStatusUpdate);
