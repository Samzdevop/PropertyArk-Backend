"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const notification_controller_1 = require("../contollers/notification.controller");
const treatment_schemas_1 = require("../schemas/treatment.schemas");
exports.notificationRouter = (0, express_1.Router)();
// Create diagnosis - VET only
exports.notificationRouter.get('/', errorHandler_1.authenticateJWT, notification_controller_1.getNotifications);
exports.notificationRouter.patch('/:notificationId/status', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(treatment_schemas_1.updateNotificationStatusSchema), notification_controller_1.updateNotificationStatus);
