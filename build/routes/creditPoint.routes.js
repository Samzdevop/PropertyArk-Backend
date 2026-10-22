"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditPointRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const creditPoint_controller_1 = require("../contollers/creditPoint.controller");
const creditPoint_schemas_1 = require("../schemas/creditPoint.schemas");
exports.creditPointRouter = (0, express_1.Router)();
// Public routes
exports.creditPointRouter.post('/webhook/paystack', creditPoint_controller_1.paystackWebhook);
exports.creditPointRouter.get('/featured', creditPoint_controller_1.getFeaturedProperties);
// Vendor routes
exports.creditPointRouter.get('/my-credit', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR']), creditPoint_controller_1.getMyCreditInfo);
exports.creditPointRouter.get('/calculate-purchase', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR']), (0, validateRequest_middleware_1.validateRequest)(creditPoint_schemas_1.calculatePurchaseSchema), creditPoint_controller_1.calculatePurchase);
exports.creditPointRouter.post('/purchase/initialize', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR']), (0, validateRequest_middleware_1.validateRequest)(creditPoint_schemas_1.initializePurchaseSchema), creditPoint_controller_1.initializePurchase);
exports.creditPointRouter.get('/purchase/verify/:reference', creditPoint_controller_1.verifyPurchase);
exports.creditPointRouter.patch('/feature/:propertyId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR']), creditPoint_controller_1.featureProperty);
// Admin routes
exports.creditPointRouter.get('/settings', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), creditPoint_controller_1.getSettings);
exports.creditPointRouter.patch('/settings', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(creditPoint_schemas_1.updateSettingsSchema), creditPoint_controller_1.updateSettings);
exports.creditPointRouter.patch('/unfeature/:propertyId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), creditPoint_controller_1.unfeatureProperty);
exports.creditPointRouter.post('/cleanup-expired', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), creditPoint_controller_1.cleanupExpiredFeatured);
exports.creditPointRouter.post('/admin-gift', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(creditPoint_schemas_1.adminGiftCreditPointsSchema), creditPoint_controller_1.adminGiftCreditPoints);
