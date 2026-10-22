"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const chatSession_service_1 = require("./chatSession.service");
const chatMessage_service_1 = require("./chatMessage.service");
const logger_1 = __importDefault(require("../config/logger"));
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../prisma"));
class SocketService {
    static io = null;
    static connectedUsers = new Map(); // userId -> socketId
    static availableStaff = new Set(); // staffIds
    /**
     * Initialize Socket.IO server
     */
    static initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
                credentials: true,
                methods: ['GET', 'POST']
            },
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });
        this.setupMiddleware();
        this.setupHandlers();
        logger_1.default.info('Socket.IO server initialized');
        return this.io;
    }
    /**
     * Setup authentication middleware
     */
    static setupMiddleware() {
        if (!this.io)
            return;
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token;
                if (!token) {
                    return next(new Error('Authentication token required'));
                }
                // Verify JWT
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                // Get user from database
                const user = await prisma_1.default.user.findUnique({
                    where: { id: decoded.id },
                    select: { id: true, email: true, role: true, fullName: true }
                });
                if (!user) {
                    return next(new Error('User not found'));
                }
                socket.userId = user.id;
                socket.userRole = user.role;
                socket.userEmail = user.email;
                next();
            }
            catch (error) {
                logger_1.default.error('Socket authentication failed:', error.message);
                next(new Error('Authentication failed'));
            }
        });
    }
    /**
     * Setup event handlers
     */
    static setupHandlers() {
        if (!this.io)
            return;
        this.io.on('connection', (socket) => {
            const userId = socket.userId;
            const userRole = socket.userRole;
            logger_1.default.info(`User connected: ${userId} (${userRole}) - Socket: ${socket.id}`);
            // Track connected user
            this.connectedUsers.set(userId, socket.id);
            // Handle staff going online
            if (userRole === client_1.Role.STAFF || userRole === client_1.Role.ADMIN) {
                this.handleStaffOnline(userId, socket.id);
            }
            // Join user's personal room
            socket.join(`user_${userId}`);
            // Handle joining chat session
            socket.on('chat:join', async (data) => {
                try {
                    const { sessionId } = data;
                    // Verify access
                    const session = await prisma_1.default.chatSession.findUnique({
                        where: { id: sessionId },
                        include: {
                            participants: {
                                where: { userId, isActive: true }
                            }
                        }
                    });
                    if (!session) {
                        socket.emit('chat:error', { message: 'Chat session not found' });
                        return;
                    }
                    const isParticipant = session.participants.length > 0;
                    const isAdmin = userRole === client_1.Role.ADMIN;
                    if (!isParticipant && !isAdmin) {
                        socket.emit('chat:error', { message: 'Access denied' });
                        return;
                    }
                    // Join the session room
                    socket.join(`session_${sessionId}`);
                    // Generate Agora token
                    const tokenData = await chatSession_service_1.ChatSessionService.generateSessionToken(sessionId, userId);
                    socket.emit('chat:joined', {
                        sessionId,
                        ...tokenData
                    });
                    logger_1.default.info(`User ${userId} joined chat session ${sessionId}`);
                }
                catch (error) {
                    logger_1.default.error('Chat join error:', error);
                    socket.emit('chat:error', { message: error.message });
                }
            });
            // Handle leaving chat session
            socket.on('chat:leave', (data) => {
                const { sessionId } = data;
                socket.leave(`session_${sessionId}`);
                logger_1.default.info(`User ${userId} left chat session ${sessionId}`);
            });
            // Handle sending message
            socket.on('chat:message', async (data) => {
                try {
                    const { sessionId, content, messageType, metadata } = data;
                    const message = await chatMessage_service_1.ChatMessageService.saveMessage(sessionId, userId, content, messageType || 'text', undefined, metadata);
                    // Broadcast to all participants in the session
                    this.io.to(`session_${sessionId}`).emit('chat:new-message', {
                        sessionId,
                        message: {
                            ...message,
                            sender: {
                                id: message.sender.id,
                                fullName: message.sender.fullName,
                                avatar: message.sender.avatar,
                                role: message.sender.role
                            }
                        }
                    });
                    logger_1.default.debug(`Message sent in session ${sessionId} by ${userId}`);
                }
                catch (error) {
                    logger_1.default.error('Message send error:', error);
                    socket.emit('chat:error', { message: error.message });
                }
            });
            // Handle typing indicators
            socket.on('chat:typing', (data) => {
                const { sessionId, isTyping } = data;
                socket.to(`session_${sessionId}`).emit('chat:user-typing', {
                    sessionId,
                    userId,
                    isTyping
                });
            });
            // Handle message read
            socket.on('chat:read', async (data) => {
                try {
                    const { sessionId } = data;
                    await chatMessage_service_1.ChatMessageService.markMessagesAsRead(sessionId, userId);
                    socket.to(`session_${sessionId}`).emit('chat:messages-read', {
                        sessionId,
                        userId,
                        readAt: new Date()
                    });
                }
                catch (error) {
                    logger_1.default.error('Mark read error:', error);
                }
            });
            // Handle staff request assignment
            socket.on('staff:accept-request', async (data) => {
                try {
                    if (userRole !== client_1.Role.STAFF && userRole !== client_1.Role.ADMIN) {
                        socket.emit('staff:error', { message: 'Only staff can accept requests' });
                        return;
                    }
                    const { requestId } = data;
                    const result = await chatSession_service_1.ChatSessionService.assignRequestToStaff(requestId, userId);
                    // Notify the user
                    const session = await prisma_1.default.chatSession.findUnique({
                        where: { id: result.session.id },
                        include: {
                            participants: true
                        }
                    });
                    if (session) {
                        const userIds = session.participants.map(p => p.userId);
                        userIds.forEach(uid => {
                            this.io.to(`user_${uid}`).emit('chat:session-assigned', {
                                sessionId: session.id,
                                assignedStaffId: userId
                            });
                        });
                    }
                    socket.emit('staff:request-accepted', { requestId });
                    logger_1.default.info(`Staff ${userId} accepted request ${requestId}`);
                }
                catch (error) {
                    logger_1.default.error('Accept request error:', error);
                    socket.emit('staff:error', { message: error.message });
                }
            });
            // Handle transfer request
            socket.on('staff:transfer-request', async (data) => {
                try {
                    if (userRole !== client_1.Role.STAFF && userRole !== client_1.Role.ADMIN) {
                        socket.emit('staff:error', { message: 'Only staff can transfer requests' });
                        return;
                    }
                    const { requestId, toStaffId, reason } = data;
                    const result = await chatSession_service_1.ChatSessionService.transferRequest(requestId, userId, toStaffId, reason);
                    // Notify the target staff
                    this.io.to(`user_${toStaffId}`).emit('staff:request-transferred-to-you', {
                        requestId,
                        fromStaffId: userId
                    });
                    // Notify the user
                    const request = await prisma_1.default.chatRequest.findUnique({
                        where: { id: requestId },
                        include: { session: true }
                    });
                    if (request) {
                        this.io.to(`user_${request.userId}`).emit('chat:staff-changed', {
                            sessionId: request.session.id,
                            newStaffId: toStaffId
                        });
                    }
                    socket.emit('staff:request-transferred', { requestId });
                    logger_1.default.info(`Staff ${userId} transferred request ${requestId} to ${toStaffId}`);
                }
                catch (error) {
                    logger_1.default.error('Transfer request error:', error);
                    socket.emit('staff:error', { message: error.message });
                }
            });
            // Handle resolve request
            socket.on('staff:resolve-request', async (data) => {
                try {
                    if (userRole !== client_1.Role.STAFF && userRole !== client_1.Role.ADMIN) {
                        socket.emit('staff:error', { message: 'Only staff can resolve requests' });
                        return;
                    }
                    const { requestId, resolutionNote } = data;
                    const result = await chatSession_service_1.ChatSessionService.resolveRequest(requestId, userId, resolutionNote);
                    // Get session to notify participants
                    const request = await prisma_1.default.chatRequest.findUnique({
                        where: { id: requestId },
                        include: {
                            session: {
                                include: {
                                    participants: true
                                }
                            }
                        }
                    });
                    if (request) {
                        this.io.to(`session_${request.session.id}`).emit('chat:session-ended', {
                            sessionId: request.session.id,
                            resolvedBy: userId,
                            resolutionNote
                        });
                        // Notify user
                        this.io.to(`user_${request.userId}`).emit('chat:request-resolved', {
                            requestId,
                            resolvedBy: userId
                        });
                    }
                    socket.emit('staff:request-resolved', { requestId });
                    logger_1.default.info(`Staff ${userId} resolved request ${requestId}`);
                }
                catch (error) {
                    logger_1.default.error('Resolve request error:', error);
                    socket.emit('staff:error', { message: error.message });
                }
            });
            // Handle available staff list request
            socket.on('staff:get-available', async () => {
                try {
                    const availableStaff = await chatSession_service_1.ChatSessionService.getAvailableStaff();
                    socket.emit('staff:available-list', availableStaff);
                }
                catch (error) {
                    logger_1.default.error('Get available staff error:', error);
                }
            });
            // Handle disconnection
            socket.on('disconnect', async () => {
                logger_1.default.info(`User disconnected: ${userId} - Socket: ${socket.id}`);
                // Remove from connected users
                if (this.connectedUsers.get(userId) === socket.id) {
                    this.connectedUsers.delete(userId);
                }
                // Update staff status if staff
                if (userRole === client_1.Role.STAFF || userRole === client_1.Role.ADMIN) {
                    await this.handleStaffOffline(userId);
                }
            });
        });
    }
    /**
     * Handle staff going online
     */
    static async handleStaffOnline(staffId, socketId) {
        try {
            await chatSession_service_1.ChatSessionService.setStaffStatus(staffId, {
                isOnline: true,
                isAvailable: true,
                socketId
            });
            this.availableStaff.add(staffId);
            // Notify pending users that staff is available
            await this.notifyPendingUsers();
            logger_1.default.info(`Staff ${staffId} is now online and available`);
        }
        catch (error) {
            logger_1.default.error(`Failed to set staff online: ${error}`);
        }
    }
    /**
     * Handle staff going offline
     */
    static async handleStaffOffline(staffId) {
        try {
            await chatSession_service_1.ChatSessionService.setStaffStatus(staffId, {
                isOnline: false,
                isAvailable: false
            });
            this.availableStaff.delete(staffId);
            // Reassign their active chats to other available staff
            await this.reassignActiveChats(staffId);
            logger_1.default.info(`Staff ${staffId} is now offline`);
        }
        catch (error) {
            logger_1.default.error(`Failed to set staff offline: ${error}`);
        }
    }
    /**
     * Notify pending users that staff is available
     */
    static async notifyPendingUsers() {
        try {
            // Get pending requests
            const pendingRequests = await prisma_1.default.chatRequest.findMany({
                where: {
                    status: 'PENDING'
                },
                include: {
                    user: {
                        select: { id: true, fullName: true, email: true }
                    }
                }
            });
            // Notify available staff about pending requests
            const availableStaff = await chatSession_service_1.ChatSessionService.getAvailableStaff();
            for (const staff of availableStaff) {
                const staffSocketId = this.connectedUsers.get(staff.staffId);
                if (staffSocketId) {
                    this.io.to(staffSocketId).emit('staff:pending-requests', {
                        requests: pendingRequests,
                        count: pendingRequests.length
                    });
                }
            }
        }
        catch (error) {
            logger_1.default.error('Failed to notify pending users:', error);
        }
    }
    /**
     * Reassign active chats when staff goes offline
     */
    static async reassignActiveChats(staffId) {
        try {
            // Get active chats for this staff
            const activeChats = await prisma_1.default.chatRequest.findMany({
                where: {
                    assignedStaffId: staffId,
                    status: 'ASSIGNED'
                }
            });
            if (activeChats.length === 0)
                return;
            // Get available staff
            const availableStaff = await chatSession_service_1.ChatSessionService.getAvailableStaff();
            for (const chat of activeChats) {
                if (availableStaff.length > 0) {
                    // Find staff with least active chats
                    const targetStaff = availableStaff.sort((a, b) => a.activeChats - b.activeChats)[0];
                    try {
                        await chatSession_service_1.ChatSessionService.transferRequest(chat.id, staffId, targetStaff.staffId, 'Staff went offline - auto-reassigned');
                        // Notify new staff
                        const staffSocketId = this.connectedUsers.get(targetStaff.staffId);
                        if (staffSocketId) {
                            this.io.to(staffSocketId).emit('staff:request-transferred-to-you', {
                                requestId: chat.id,
                                fromStaffId: staffId,
                                reason: 'Auto-reassigned (previous staff went offline)'
                            });
                        }
                        // Notify user
                        this.io.to(`user_${chat.userId}`).emit('chat:staff-changed', {
                            sessionId: chat.sessionId,
                            newStaffId: targetStaff.staffId
                        });
                    }
                    catch (error) {
                        logger_1.default.error(`Failed to reassign chat ${chat.id}:`, error);
                    }
                }
                else {
                    // No staff available - put back in queue
                    await prisma_1.default.chatRequest.update({
                        where: { id: chat.id },
                        data: {
                            status: 'PENDING',
                            assignedStaffId: null,
                            assignedAt: null
                        }
                    });
                    // Notify user
                    this.io.to(`user_${chat.userId}`).emit('chat:staff-unavailable', {
                        sessionId: chat.sessionId,
                        message: 'Your support agent has gone offline. You will be reassigned shortly.'
                    });
                }
            }
            logger_1.default.info(`Reassigned ${activeChats.length} chats from offline staff ${staffId}`);
        }
        catch (error) {
            logger_1.default.error('Failed to reassign active chats:', error);
        }
    }
    /**
     * Get IO instance
     */
    static getIO() {
        if (!this.io) {
            throw new Error('Socket.IO not initialized');
        }
        return this.io;
    }
    /**
     * Send notification to specific user
     */
    static sendToUser(userId, event, data) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit(event, data);
        }
    }
    /**
     * Send notification to session
     */
    static sendToSession(sessionId, event, data) {
        if (this.io) {
            this.io.to(`session_${sessionId}`).emit(event, data);
        }
    }
    /**
     * Broadcast to all connected users
     */
    static broadcast(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
    /**
     * Get connected users count
     */
    static getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
    /**
     * Check if user is online
     */
    static isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
}
exports.SocketService = SocketService;
