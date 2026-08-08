"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const vendor_controller_1 = require("../contollers/vendor.controller");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const vendor_schemas_1 = require("../schemas/vendor.schemas");
exports.vendorRouter = (0, express_1.Router)();
exports.vendorRouter.get('/stats', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), vendor_controller_1.getVendorDashboardStats);
exports.vendorRouter.post('/availability', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(vendor_schemas_1.setAvailabilitySchema), vendor_controller_1.setAvailability);
exports.vendorRouter.post('/availability/single', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(vendor_schemas_1.addAvailabilitySchema), vendor_controller_1.addAvailability);
exports.vendorRouter.get('/availability', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(vendor_schemas_1.getAvailabilitySchema), vendor_controller_1.getAvailability);
exports.vendorRouter.get('/availability/vendor/:vendorId/slots', (0, validateRequest_middleware_1.validateRequest)(vendor_schemas_1.getAvailableSlotsSchema), vendor_controller_1.getAvailableSlotsForDate);
// Update availability slot
exports.vendorRouter.patch('/availability/:slotId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), vendor_controller_1.updateAvailabilitySlot);
// Delete availability slot
exports.vendorRouter.delete('/availability/:slotId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), vendor_controller_1.deleteAvailabilitySlot);
// Toggle availability slot
exports.vendorRouter.patch('/availability/:slotId/toggle', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), vendor_controller_1.toggleAvailabilitySlot);
