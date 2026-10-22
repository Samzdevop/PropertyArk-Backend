"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRequest = exports.getRequestById = exports.getAllRequests = exports.createRequest = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const professionalService_service_1 = require("../services/professionalService.service");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const createRequest = async (req, res, next) => {
    try {
        const user = req.user;
        const files = req.files;
        const { fullName, email, phone, serviceType, consultationDate, propertyReference, message } = req.body;
        const request = await professionalService_service_1.ProfessionalServiceService.createRequest(user?.id || null, { fullName, email, phone, serviceType, consultationDate, propertyReference, message }, files);
        await (0, activity_controller_1.logActivity)(user?.id || 'anonymous', 'CREATE_PROFESSIONAL_SERVICE_REQUEST', 'PROFESSIONAL_SERVICE', request.id, {
            requestNumber: request.requestNumber,
            serviceType,
            documentCount: files?.length || 0,
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Your request has been submitted. Our team will contact you shortly.", { request }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createRequest = createRequest;
const getAllRequests = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view all requests");
        }
        const { status, serviceType, page = 1, limit = 20, search } = req.query;
        const result = await professionalService_service_1.ProfessionalServiceService.getAllRequests({
            status: status,
            serviceType: serviceType,
            page: Number(page),
            limit: Number(limit),
            search: search,
        });
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_PROFESSIONAL_SERVICE_REQUESTS', 'PROFESSIONAL_SERVICE', 'list', { total: result.pagination.total, filters: { status, serviceType } }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Requests retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getAllRequests = getAllRequests;
const getRequestById = async (req, res, next) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const request = await professionalService_service_1.ProfessionalServiceService.getRequestById(id, user?.id || null, user?.role || 'USER');
        await (0, activity_controller_1.logActivity)(user?.id || 'anonymous', 'VIEW_PROFESSIONAL_SERVICE_REQUEST', 'PROFESSIONAL_SERVICE', id, { requestNumber: request.requestNumber }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Request retrieved successfully", request);
    }
    catch (error) {
        next(error);
    }
};
exports.getRequestById = getRequestById;
const deleteRequest = async (req, res, next) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can delete requests");
        }
        await professionalService_service_1.ProfessionalServiceService.deleteRequest(id, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'DELETE_PROFESSIONAL_SERVICE_REQUEST', 'PROFESSIONAL_SERVICE', id, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Request deleted successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteRequest = deleteRequest;
