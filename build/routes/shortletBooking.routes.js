"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortletBookingRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const shortletBooking_controller_1 = require("../contollers/shortletBooking.controller");
const shortlest_schemas_1 = require("../schemas/shortlest.schemas");
exports.shortletBookingRouter = (0, express_1.Router)();
exports.shortletBookingRouter.post('/', (0, validateRequest_middleware_1.validateRequest)(shortlest_schemas_1.createBookingSchema), shortletBooking_controller_1.createBooking);
// Get vendor booking stats (authenticated)
exports.shortletBookingRouter.get('/vendor-stats', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), shortletBooking_controller_1.getVendorBookingStats);
// Approve booking (vendor only)
exports.shortletBookingRouter.patch('/:bookingId/approve', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(shortlest_schemas_1.bookingIdSchema), shortletBooking_controller_1.approveBooking);
// Check-in guest (vendor only)
exports.shortletBookingRouter.patch('/:bookingId/check-in', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(shortlest_schemas_1.bookingIdSchema), shortletBooking_controller_1.checkInGuest);
// Check-out guest (vendor only)
exports.shortletBookingRouter.patch('/:bookingId/check-out', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(shortlest_schemas_1.bookingIdSchema), shortletBooking_controller_1.checkOutGuest);
// Cancel booking
exports.shortletBookingRouter.patch('/:bookingId/cancel', (0, validateRequest_middleware_1.validateRequest)(shortlest_schemas_1.bookingIdSchema), shortletBooking_controller_1.cancelBooking);
