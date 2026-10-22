"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const chat_schemas_1 = require("../schemas/chat.schemas");
const chat_controller_1 = require("../contollers/chat.controller");
exports.chatRouter = (0, express_1.Router)();
// Initialize Agora (all authenticated users)
exports.chatRouter.post('/agora/initialize', errorHandler_middleware_1.authenticateJWT, chat_controller_1.initializeAgora);
// Direct chat
exports.chatRouter.post('/direct', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.createDirectChatSchema), chat_controller_1.createDirectChat);
// Support requests
exports.chatRouter.post('/support', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['USER', 'VENDOR']), (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.createSupportRequestSchema), chat_controller_1.createSupportRequest);
exports.chatRouter.get('/support/pending', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['STAFF', 'ADMIN']), chat_controller_1.getPendingRequests);
exports.chatRouter.patch('/support/:requestId/accept', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['STAFF', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.requestIdSchema), chat_controller_1.acceptRequest);
exports.chatRouter.patch('/support/:requestId/transfer', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['STAFF', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.transferRequestSchema), chat_controller_1.transferRequest);
exports.chatRouter.patch('/support/:requestId/resolve', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['STAFF', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.resolveRequestSchema), chat_controller_1.resolveRequest);
exports.chatRouter.patch('/support/:requestId/cancel', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['USER', 'VENDOR']), (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.requestIdSchema), chat_controller_1.cancelRequest);
// Staff management
exports.chatRouter.get('/staff/available', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['STAFF', 'ADMIN']), chat_controller_1.getAvailableStaff);
exports.chatRouter.patch('/staff/status', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['STAFF', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.setStaffStatusSchema), chat_controller_1.setStaffStatus);
// Sessions
exports.chatRouter.get('/sessions', errorHandler_middleware_1.authenticateJWT, chat_controller_1.getMyChatSessions);
exports.chatRouter.get('/sessions/:sessionId', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.sessionIdSchema), chat_controller_1.getChatSessionById);
exports.chatRouter.get('/sessions/:sessionId/messages', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.sessionIdSchema), chat_controller_1.getSessionMessages);
exports.chatRouter.post('/sessions/:sessionId/token', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.sessionIdSchema), chat_controller_1.generateSessionToken);
// Messages (HTTP fallback)
exports.chatRouter.post('/messages', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(chat_schemas_1.sendMessageSchema), chat_controller_1.sendMessage);
exports.chatRouter.get('/messages/unread', errorHandler_middleware_1.authenticateJWT, chat_controller_1.getUnreadCount);
