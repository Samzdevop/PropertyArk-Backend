"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInquiryStats = exports.reviewInquiry = exports.getInquiryById = exports.getUserInquiries = exports.getVendorInquiries = exports.createInquiry = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const inquiry_service_1 = require("../services/inquiry.service");
const activity_controller_1 = require("./activity.controller");
const BadRequestError_1 = require("../errors/BadRequestError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const createInquiry = async (req, res, next) => {
    try {
        const user = req.user;
        const { propertyId, name, location, message, meetingType } = req.body;
        const inquiry = await inquiry_service_1.InquiryService.createInquiry(user.id, {
            propertyId,
            name,
            location,
            message,
            meetingType
        });
        await (0, activity_controller_1.logActivity)(user.id, 'CREATE_INQUIRY', 'INQUIRY', inquiry.id, {
            propertyId,
            inquiryNumber: inquiry.inquiryNumber,
            meetingType
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Inquiry sent successfully", inquiry, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createInquiry = createInquiry;
/**
 * Get vendor inquiries
 */
const getVendorInquiries = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can view vendor inquiries");
        }
        const { status, propertyId, page = 1, limit = 20 } = req.query;
        const result = await inquiry_service_1.InquiryService.getVendorInquiries(user.id, {
            status: status,
            propertyId: propertyId,
            page: Number(page),
            limit: Number(limit)
        });
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_VENDOR_INQUIRIES', 'INQUIRY', 'list', { filters: { status, propertyId }, total: result.pagination.total }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Vendor inquiries retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorInquiries = getVendorInquiries;
/**
 * Get user inquiries
 */
const getUserInquiries = async (req, res, next) => {
    try {
        const user = req.user;
        const { page = 1, limit = 20 } = req.query;
        const result = await inquiry_service_1.InquiryService.getUserInquiries(user.id, Number(page), Number(limit));
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_USER_INQUIRIES', 'INQUIRY', 'list', { total: result.pagination.total }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Your inquiries retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getUserInquiries = getUserInquiries;
/**
 * Get inquiry by ID
 */
const getInquiryById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const inquiry = await inquiry_service_1.InquiryService.getInquiryById(id, user.id, user.role);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_INQUIRY', 'INQUIRY', id, { inquiryNumber: inquiry.inquiryNumber }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Inquiry retrieved successfully", inquiry);
    }
    catch (error) {
        next(error);
    }
};
exports.getInquiryById = getInquiryById;
/**
 * Review inquiry (accept/decline)
 */
const reviewInquiry = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const { status, reason } = req.body;
        if (!status || (status !== 'ACCEPTED' && status !== 'DECLINED')) {
            throw new BadRequestError_1.BadRequestError("Status must be 'ACCEPTED' or 'DECLINED'");
        }
        const inquiry = await inquiry_service_1.InquiryService.reviewInquiry(id, user.id, { status, reason });
        await (0, activity_controller_1.logActivity)(user.id, status === 'ACCEPTED' ? 'ACCEPT_INQUIRY' : 'DECLINE_INQUIRY', 'INQUIRY', id, {
            inquiryNumber: inquiry.inquiryNumber,
            status,
            ...(reason && { reason })
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `Inquiry ${status.toLowerCase()} successfully`, inquiry);
    }
    catch (error) {
        next(error);
    }
};
exports.reviewInquiry = reviewInquiry;
/**
 * Get inquiry stats for vendor
 */
const getInquiryStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can view inquiry stats");
        }
        const stats = await inquiry_service_1.InquiryService.getInquiryStats(user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_INQUIRY_STATS', 'INQUIRY', 'stats', { total: stats.total }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Inquiry statistics retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getInquiryStats = getInquiryStats;
