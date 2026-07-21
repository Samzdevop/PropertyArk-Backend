"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inquiryRouter = void 0;
// routes/inquiry.routes.ts
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const inquiry_controller_1 = require("../contollers/inquiry.controller");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const inquiry_schemas_1 = require("../schemas/inquiry.schemas");
exports.inquiryRouter = (0, express_1.Router)();
exports.inquiryRouter.post('/', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['USER']), (0, validateRequest_middleware_1.validateRequest)(inquiry_schemas_1.createInquirySchema), inquiry_controller_1.createInquiry);
// Get vendor inquiries (Vendor/Admin only)
exports.inquiryRouter.get('/vendor', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(inquiry_schemas_1.getInquiriesQuerySchema), inquiry_controller_1.getVendorInquiries);
// Get inquiry stats (Vendor/Admin only)
exports.inquiryRouter.get('/vendor/stats', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), inquiry_controller_1.getInquiryStats);
// Get user inquiries
exports.inquiryRouter.get('/my', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['USER']), (0, validateRequest_middleware_1.validateRequest)(inquiry_schemas_1.getInquiriesQuerySchema), inquiry_controller_1.getUserInquiries);
// Get inquiry by ID
exports.inquiryRouter.get('/:id', errorHandler_middleware_1.authenticateJWT, inquiry_controller_1.getInquiryById);
// Review inquiry (accept/decline)
exports.inquiryRouter.patch('/:id/review', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR']), (0, validateRequest_middleware_1.validateRequest)(inquiry_schemas_1.reviewInquirySchema), inquiry_controller_1.reviewInquiry);
