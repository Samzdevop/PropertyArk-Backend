"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSubscriber = exports.unsubscribeByEmail = exports.unsubscribeByToken = exports.getAllSubscribers = exports.subscribe = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const newsletter_service_1 = require("../services/newsletter.service");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const subscribe = async (req, res, next) => {
    try {
        const { name, email } = req.body;
        const subscriber = await newsletter_service_1.NewsletterService.subscribe({ name, email });
        await (0, activity_controller_1.logActivity)('anonymous', 'NEWSLETTER_SUBSCRIBE', 'NEWSLETTER', subscriber.id, { email }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Successfully subscribed! Check your email for confirmation.", { email: subscriber.email }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.subscribe = subscribe;
const getAllSubscribers = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view subscribers");
        }
        const { isSubscribed, search, page = 1, limit = 20 } = req.query;
        const result = await newsletter_service_1.NewsletterService.getAllSubscribers({
            isSubscribed: isSubscribed === 'true' ? true : isSubscribed === 'false' ? false : undefined,
            search: search,
            page: Number(page),
            limit: Number(limit),
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Subscribers retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getAllSubscribers = getAllSubscribers;
const unsubscribeByToken = async (req, res, next) => {
    try {
        const { token } = req.query;
        const { reason } = req.body;
        const result = await newsletter_service_1.NewsletterService.unsubscribeByToken(token, reason);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, result.message, result);
    }
    catch (error) {
        next(error);
    }
};
exports.unsubscribeByToken = unsubscribeByToken;
const unsubscribeByEmail = async (req, res, next) => {
    try {
        const { email, reason } = req.body;
        const result = await newsletter_service_1.NewsletterService.unsubscribeByEmail(email, reason);
        await (0, activity_controller_1.logActivity)('anonymous', 'NEWSLETTER_UNSUBSCRIBE', 'NEWSLETTER', email, { email, reason }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, result.message, result);
    }
    catch (error) {
        next(error);
    }
};
exports.unsubscribeByEmail = unsubscribeByEmail;
const deleteSubscriber = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can delete subscribers");
        }
        const { id } = req.params;
        await newsletter_service_1.NewsletterService.deleteSubscriber(id, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'DELETE_NEWSLETTER_SUBSCRIBER', 'NEWSLETTER', id, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Subscriber deleted successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteSubscriber = deleteSubscriber;
