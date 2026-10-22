"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteContact = exports.getContactById = exports.getAllContacts = exports.createContact = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const contact_service_1 = require("../services/contact.service");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const createContact = async (req, res, next) => {
    try {
        const { fullName, email, subject, message } = req.body;
        const contact = await contact_service_1.ContactService.createContact({
            fullName,
            email,
            subject,
            message,
        });
        await (0, activity_controller_1.logActivity)('anonymous', 'CREATE_CONTACT', 'CONTACT', contact.id, { contactNumber: contact.contactNumber, subject }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Your message has been sent. We'll get back to you shortly.", { contact: { contactNumber: contact.contactNumber } }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createContact = createContact;
const getAllContacts = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view contacts");
        }
        const { status, page = 1, limit = 20, search } = req.query;
        const result = await contact_service_1.ContactService.getAllContacts({
            status: status,
            page: Number(page),
            limit: Number(limit),
            search: search,
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Contacts retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getAllContacts = getAllContacts;
const getContactById = async (req, res, next) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const contact = await contact_service_1.ContactService.getContactById(id, user.id, user.role);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Contact retrieved successfully", contact);
    }
    catch (error) {
        next(error);
    }
};
exports.getContactById = getContactById;
const deleteContact = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can delete contacts");
        }
        const { id } = req.params;
        await contact_service_1.ContactService.deleteContact(id, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'DELETE_CONTACT', 'CONTACT', id, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Contact deleted successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteContact = deleteContact;
