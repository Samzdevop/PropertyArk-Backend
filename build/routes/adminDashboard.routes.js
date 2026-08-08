"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDashboardRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const adminDashboard_controller_1 = require("../contollers/adminDashboard.controller");
const admindashboard_schemas_1 = require("../schemas/admindashboard.schemas");
exports.adminDashboardRouter = (0, express_1.Router)();
exports.adminDashboardRouter.get('/nin-stats', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), adminDashboard_controller_1.getNINStats);
// Property management statistics
exports.adminDashboardRouter.get('/property-stats', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(admindashboard_schemas_1.propertyManagementStatsSchema), adminDashboard_controller_1.getPropertyManagementStats);
// Admin dashboard overview
exports.adminDashboardRouter.get('/dashboard', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), adminDashboard_controller_1.getAdminDashboardOverview);
// Platform overview
exports.adminDashboardRouter.get('/platform-overview', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), adminDashboard_controller_1.getPlatformOverview);
