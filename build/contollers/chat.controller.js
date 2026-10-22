"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSessionToken = exports.setStaffStatus = exports.getAvailableStaff = exports.cancelRequest = exports.resolveRequest = exports.transferRequest = exports.acceptRequest = exports.getPendingRequests = exports.getUnreadCount = exports.sendMessage = exports.getSessionMessages = exports.getChatSessionById = exports.getMyChatSessions = exports.createSupportRequest = exports.createDirectChat = exports.initializeAgora = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const chatSession_service_1 = require("../services/chatSession.service");
const chatMessage_service_1 = require("../services/chatMessage.service");
const agora_service_1 = require("../services/agora.service");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
/**
 * Initialize Agora token for current user
 */
const initializeAgora = async (req, res, next) => {
    try {
        const user = req.user;
        // Generate Agora user ID
        const agoraUserId = `user_${user.id}`;
        // Register user in Agora if not exists
        await agora_service_1.AgoraService.registerUser(agoraUserId, user.fullName);
        // Generate token
        const token = agora_service_1.AgoraService.generateChatToken(agoraUserId, 86400);
        await (0, activity_controller_1.logActivity)(user.id, 'INITIALIZE_AGORA', 'CHAT', user.id, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Agora initialized successfully", {
            agoraUserId,
            agoraAppId: process.env.AGORA_APP_ID,
            token,
            expiresIn: 86400
        });
    }
    catch (error) {
        next(error);
    }
};
exports.initializeAgora = initializeAgora;
/**
 * Create direct chat
 */
const createDirectChat = async (req, res, next) => {
    try {
        const user = req.user;
        const { participantId, subject, propertyId } = req.body;
        const session = await chatSession_service_1.ChatSessionService.createDirectChat(user.id, participantId, subject, propertyId);
        await (0, activity_controller_1.logActivity)(user.id, 'CREATE_DIRECT_CHAT', 'CHAT', session.id, {
            sessionNumber: session.sessionNumber,
            participantId
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Chat created successfully", session, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createDirectChat = createDirectChat;
/**
 * Create support request
 */
const createSupportRequest = async (req, res, next) => {
    try {
        const user = req.user;
        const { subject, description, priority } = req.body;
        const result = await chatSession_service_1.ChatSessionService.createSupportRequest(user.id, subject, description, priority);
        await (0, activity_controller_1.logActivity)(user.id, 'CREATE_SUPPORT_REQUEST', 'CHAT', result.request.id, {
            requestNumber: result.request.requestNumber,
            subject,
            priority
        }, req);
        // Notify available staff via socket
        try {
            const { SocketService } = await Promise.resolve().then(() => __importStar(require('../services/socket.service')));
            SocketService.broadcast('staff:new-request', {
                request: result.request,
                session: result.session
            });
        }
        catch (error) {
            // Socket might not be initialized
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Support request created. A staff member will be with you shortly.", result, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createSupportRequest = createSupportRequest;
/**
 * Get my chat sessions
 */
const getMyChatSessions = async (req, res, next) => {
    try {
        const user = req.user;
        const { type, status, page = 1, limit = 20 } = req.query;
        const result = await chatSession_service_1.ChatSessionService.getUserChatSessions(user.id, {
            type: type,
            status: status,
            page: Number(page),
            limit: Number(limit)
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Chat sessions retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getMyChatSessions = getMyChatSessions;
/**
 * Get chat session by ID
 */
const getChatSessionById = async (req, res, next) => {
    try {
        const user = req.user;
        const { sessionId } = req.params;
        const session = await chatSession_service_1.ChatSessionService.getChatSessionById(sessionId, user.id, user.role);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Chat session retrieved successfully", session);
    }
    catch (error) {
        next(error);
    }
};
exports.getChatSessionById = getChatSessionById;
/**
 * Get messages for a session
 */
const getSessionMessages = async (req, res, next) => {
    try {
        const user = req.user;
        const { sessionId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const result = await chatMessage_service_1.ChatMessageService.getSessionMessages(sessionId, user.id, user.role, Number(page), Number(limit));
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Messages retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getSessionMessages = getSessionMessages;
/**
 * Send message via HTTP (fallback)
 */
const sendMessage = async (req, res, next) => {
    try {
        const user = req.user;
        const { sessionId, content, messageType, metadata } = req.body;
        const message = await chatMessage_service_1.ChatMessageService.saveMessage(sessionId, user.id, content, messageType || 'text', undefined, metadata);
        // Broadcast via socket
        try {
            const { SocketService } = await Promise.resolve().then(() => __importStar(require('../services/socket.service')));
            SocketService.sendToSession(sessionId, 'chat:new-message', {
                sessionId,
                message
            });
        }
        catch (error) {
            // Socket might not be initialized
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Message sent successfully", message, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.sendMessage = sendMessage;
/**
 * Get unread message count
 */
const getUnreadCount = async (req, res, next) => {
    try {
        const user = req.user;
        const count = await chatMessage_service_1.ChatMessageService.getUnreadCount(user.id);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Unread count retrieved", { count });
    }
    catch (error) {
        next(error);
    }
};
exports.getUnreadCount = getUnreadCount;
/**
 * Get pending support requests (Staff/Admin only)
 */
const getPendingRequests = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.STAFF && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only staff and admins can view pending requests");
        }
        const { status, priority, page = 1, limit = 20 } = req.query;
        const result = await chatSession_service_1.ChatSessionService.getPendingRequests({
            status: status,
            priority: priority,
            page: Number(page),
            limit: Number(limit)
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Pending requests retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getPendingRequests = getPendingRequests;
/**
 * Accept a support request (Staff only)
 */
const acceptRequest = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.STAFF && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only staff and admins can accept requests");
        }
        const { requestId } = req.params;
        const result = await chatSession_service_1.ChatSessionService.assignRequestToStaff(requestId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'ACCEPT_SUPPORT_REQUEST', 'CHAT', requestId, {
            requestNumber: result.request.requestNumber
        }, req);
        // Notify via socket
        try {
            const { SocketService } = await Promise.resolve().then(() => __importStar(require('../services/socket.service')));
            SocketService.sendToUser(result.request.userId, 'chat:request-accepted', {
                requestId,
                staffId: user.id
            });
        }
        catch (error) {
            // Socket might not be initialized
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Request accepted successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.acceptRequest = acceptRequest;
/**
 * Transfer a support request (Staff only)
 */
const transferRequest = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.STAFF && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only staff and admins can transfer requests");
        }
        const { requestId } = req.params;
        const { toStaffId, reason } = req.body;
        const result = await chatSession_service_1.ChatSessionService.transferRequest(requestId, user.id, toStaffId, reason);
        await (0, activity_controller_1.logActivity)(user.id, 'TRANSFER_SUPPORT_REQUEST', 'CHAT', requestId, { toStaffId, reason }, req);
        // Notify via socket
        try {
            const { SocketService } = await Promise.resolve().then(() => __importStar(require('../services/socket.service')));
            SocketService.sendToUser(toStaffId, 'chat:request-transferred-to-you', {
                requestId,
                fromStaffId: user.id,
                reason
            });
        }
        catch (error) {
            // Socket might not be initialized
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Request transferred successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.transferRequest = transferRequest;
/**
 * Resolve a support request (Staff only)
 */
const resolveRequest = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.STAFF && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only staff and admins can resolve requests");
        }
        const { requestId } = req.params;
        const { resolutionNote } = req.body;
        const result = await chatSession_service_1.ChatSessionService.resolveRequest(requestId, user.id, resolutionNote);
        await (0, activity_controller_1.logActivity)(user.id, 'RESOLVE_SUPPORT_REQUEST', 'CHAT', requestId, { resolutionNote }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Request resolved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.resolveRequest = resolveRequest;
/**
 * Cancel a support request (User only)
 */
const cancelRequest = async (req, res, next) => {
    try {
        const user = req.user;
        const { requestId } = req.params;
        const result = await chatSession_service_1.ChatSessionService.cancelRequest(requestId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'CANCEL_SUPPORT_REQUEST', 'CHAT', requestId, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Request cancelled successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.cancelRequest = cancelRequest;
/**
 * Get available staff (Staff/Admin only)
 */
const getAvailableStaff = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.STAFF && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only staff and admins can view available staff");
        }
        const staff = await chatSession_service_1.ChatSessionService.getAvailableStaff();
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Available staff retrieved successfully", staff);
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailableStaff = getAvailableStaff;
// Set staff status (Staff only)
const setStaffStatus = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.STAFF && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only staff and admins can set their status");
        }
        const { isOnline, isAvailable, maxChats } = req.body;
        const status = await chatSession_service_1.ChatSessionService.setStaffStatus(user.id, {
            isOnline,
            isAvailable,
            maxChats
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Staff status updated successfully", status);
    }
    catch (error) {
        next(error);
    }
};
exports.setStaffStatus = setStaffStatus;
//Generate session token
const generateSessionToken = async (req, res, next) => {
    try {
        const user = req.user;
        const { sessionId } = req.params;
        const tokenData = await chatSession_service_1.ChatSessionService.generateSessionToken(sessionId, user.id);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Session token generated successfully", tokenData);
    }
    catch (error) {
        next(error);
    }
};
exports.generateSessionToken = generateSessionToken;
