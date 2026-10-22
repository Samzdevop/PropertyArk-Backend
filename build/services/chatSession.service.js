"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSessionService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const BadRequestError_1 = require("../errors/BadRequestError");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const logger_1 = __importDefault(require("../config/logger"));
const agora_service_1 = require("./agora.service");
class ChatSessionService {
    static generateSessionNumber() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `CHT-${year}-${random}`;
    }
    static generateRequestNumber() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `REQ-${year}-${random}`;
    }
    static getRoleString(role) {
        switch (role) {
            case client_1.Role.USER: return client_1.ChatParticipantRole.USER;
            case client_1.Role.VENDOR: return client_1.ChatParticipantRole.VENDOR;
            case client_1.Role.STAFF: return client_1.ChatParticipantRole.STAFF;
            case client_1.Role.ADMIN: return client_1.ChatParticipantRole.ADMIN;
            default: return client_1.ChatParticipantRole.USER;
        }
    }
    /**
     * Create a direct chat between two users (User-User, Vendor-Vendor, User-Vendor)
     */
    static async createDirectChat(initiatorId, participantId, subject, propertyId) {
        // Get both users
        const [initiator, participant] = await Promise.all([
            prisma_1.default.user.findUnique({
                where: { id: initiatorId },
                select: { id: true, fullName: true, role: true, email: true }
            }),
            prisma_1.default.user.findUnique({
                where: { id: participantId },
                select: { id: true, fullName: true, role: true, email: true }
            })
        ]);
        if (!initiator) {
            throw new NotFoundError_1.NotFoundError("Initiator not found");
        }
        if (!participant) {
            throw new NotFoundError_1.NotFoundError("Participant not found");
        }
        if (initiatorId === participantId) {
            throw new BadRequestError_1.BadRequestError("Cannot create chat with yourself");
        }
        // Validate role combinations for direct chat
        const allowedPairs = [
            // User <-> Vendor
            [client_1.Role.USER, client_1.Role.VENDOR],
            [client_1.Role.VENDOR, client_1.Role.USER],
            // User <-> User
            [client_1.Role.USER, client_1.Role.USER],
            // Vendor <-> Vendor
            [client_1.Role.VENDOR, client_1.Role.VENDOR],
        ];
        const isValidPair = allowedPairs.some(([r1, r2]) => initiator.role === r1 && participant.role === r2);
        if (!isValidPair) {
            throw new ForbiddenError_1.ForbiddenError(`Direct chat between ${initiator.role} and ${participant.role} is not allowed. For support, use the support request endpoint.`);
        }
        // Check if there's an existing active chat between these two users
        const existingSession = await prisma_1.default.chatSession.findFirst({
            where: {
                type: client_1.ChatType.DIRECT,
                status: client_1.ChatSessionStatus.ACTIVE,
                AND: [
                    { participants: { some: { userId: initiatorId } } },
                    { participants: { some: { userId: participantId } } }
                ]
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: { id: true, fullName: true, role: true, avatar: true }
                        }
                    }
                }
            }
        });
        if (existingSession) {
            return existingSession;
        }
        // Create Agora channel name (unique per session)
        const agoraChannel = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // Create chat session
        const session = await prisma_1.default.chatSession.create({
            data: {
                sessionNumber: this.generateSessionNumber(),
                type: client_1.ChatType.DIRECT,
                status: client_1.ChatSessionStatus.ACTIVE,
                agoraChannel,
                initiatorId,
                initiatorRole: this.getRoleString(initiator.role),
                subject: subject || `Chat between ${initiator.fullName} and ${participant.fullName}`,
                propertyId: propertyId || null,
                participants: {
                    create: [
                        {
                            userId: initiatorId,
                            role: this.getRoleString(initiator.role),
                            isActive: true
                        },
                        {
                            userId: participantId,
                            role: this.getRoleString(participant.role),
                            isActive: true
                        }
                    ]
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: { id: true, fullName: true, role: true, avatar: true, email: true }
                        }
                    }
                },
                property: {
                    select: { id: true, name: true, address: true }
                }
            }
        });
        logger_1.default.info(`Direct chat created: ${session.sessionNumber} between ${initiator.email} and ${participant.email}`);
        return session;
    }
    /**
     * Create a support chat request (User/Vendor -> Admin/Staff)
     */
    static async createSupportRequest(initiatorId, subject, description, priority = 'NORMAL') {
        // Get initiator
        const initiator = await prisma_1.default.user.findUnique({
            where: { id: initiatorId },
            select: { id: true, fullName: true, role: true, email: true }
        });
        if (!initiator) {
            throw new NotFoundError_1.NotFoundError("User not found");
        }
        // Only USER and VENDOR can create support requests
        if (initiator.role !== client_1.Role.USER && initiator.role !== client_1.Role.VENDOR) {
            throw new ForbiddenError_1.ForbiddenError("Only users and vendors can create support requests");
        }
        // Check for existing pending request from this user
        const existingRequest = await prisma_1.default.chatRequest.findFirst({
            where: {
                userId: initiatorId,
                status: { in: [client_1.ChatRequestStatus.PENDING, client_1.ChatRequestStatus.ASSIGNED] }
            }
        });
        if (existingRequest) {
            throw new BadRequestError_1.BadRequestError("You already have an active support request. Please wait for it to be resolved or cancel it.");
        }
        // Create Agora channel
        const agoraChannel = `support_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // Create chat session + request in a transaction
        const result = await prisma_1.default.$transaction(async (tx) => {
            const session = await tx.chatSession.create({
                data: {
                    sessionNumber: this.generateSessionNumber(),
                    type: client_1.ChatType.SUPPORT,
                    status: client_1.ChatSessionStatus.ACTIVE,
                    agoraChannel,
                    initiatorId,
                    initiatorRole: this.getRoleString(initiator.role),
                    subject,
                    participants: {
                        create: [
                            {
                                userId: initiatorId,
                                role: this.getRoleString(initiator.role),
                                isActive: true
                            }
                        ]
                    }
                }
            });
            const request = await tx.chatRequest.create({
                data: {
                    requestNumber: this.generateRequestNumber(),
                    sessionId: session.id,
                    userId: initiatorId,
                    userRole: this.getRoleString(initiator.role),
                    subject,
                    description: description || null,
                    priority,
                    status: client_1.ChatRequestStatus.PENDING
                }
            });
            return { session, request };
        });
        // Notify admin/staff via socket (will be handled in socket service)
        logger_1.default.info(`Support request created: ${result.request.requestNumber} by ${initiator.email}`);
        return {
            ...result.session,
            request: result.request
        };
    }
    /**
     * Assign a support request to a staff member
     */
    static async assignRequestToStaff(requestId, staffId) {
        // Get staff
        const staff = await prisma_1.default.user.findUnique({
            where: { id: staffId },
            select: { id: true, fullName: true, role: true, email: true }
        });
        if (!staff) {
            throw new NotFoundError_1.NotFoundError("Staff not found");
        }
        if (staff.role !== client_1.Role.STAFF && staff.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only staff and admins can be assigned to support requests");
        }
        // Get request
        const request = await prisma_1.default.chatRequest.findUnique({
            where: { id: requestId },
            include: {
                session: {
                    include: {
                        participants: {
                            include: {
                                user: { select: { id: true, fullName: true, email: true } }
                            }
                        }
                    }
                }
            }
        });
        if (!request) {
            throw new NotFoundError_1.NotFoundError("Support request not found");
        }
        if (request.status !== client_1.ChatRequestStatus.PENDING) {
            throw new BadRequestError_1.BadRequestError(`Request is already ${request.status.toLowerCase()}`);
        }
        // Get staff status
        const staffStatus = await prisma_1.default.staffStatus.findUnique({
            where: { staffId }
        });
        if (staffStatus && staffStatus.activeChats >= staffStatus.maxChats) {
            throw new BadRequestError_1.BadRequestError("Staff member has reached maximum concurrent chats");
        }
        // Assign in transaction
        const result = await prisma_1.default.$transaction(async (tx) => {
            // Update request
            const updatedRequest = await tx.chatRequest.update({
                where: { id: requestId },
                data: {
                    status: client_1.ChatRequestStatus.ASSIGNED,
                    assignedStaffId: staffId,
                    assignedAt: new Date()
                }
            });
            // Update session
            const updatedSession = await tx.chatSession.update({
                where: { id: request.sessionId },
                data: {
                    assignedToId: staffId
                }
            });
            // Add staff as participant
            await tx.chatParticipant.create({
                data: {
                    sessionId: request.sessionId,
                    userId: staffId,
                    role: this.getRoleString(staff.role),
                    isActive: true
                }
            });
            // Update staff status
            await tx.staffStatus.upsert({
                where: { staffId },
                update: {
                    activeChats: { increment: 1 },
                    isAvailable: false
                },
                create: {
                    staffId,
                    isOnline: true,
                    isAvailable: false,
                    activeChats: 1
                }
            });
            return { request: updatedRequest, session: updatedSession };
        });
        logger_1.default.info(`Support request ${request.requestNumber} assigned to ${staff.email}`);
        return result;
    }
    /**
     * Transfer a support request to another staff member
     */
    static async transferRequest(requestId, fromStaffId, toStaffId, reason) {
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
        if (!request) {
            throw new NotFoundError_1.NotFoundError("Support request not found");
        }
        if (request.assignedStaffId !== fromStaffId) {
            throw new ForbiddenError_1.ForbiddenError("You are not assigned to this request");
        }
        if (request.status !== client_1.ChatRequestStatus.ASSIGNED) {
            throw new BadRequestError_1.BadRequestError(`Cannot transfer request with status ${request.status}`);
        }
        // Verify target staff
        const targetStaff = await prisma_1.default.user.findUnique({
            where: { id: toStaffId },
            select: { id: true, fullName: true, role: true, email: true }
        });
        if (!targetStaff) {
            throw new NotFoundError_1.NotFoundError("Target staff not found");
        }
        if (targetStaff.role !== client_1.Role.STAFF && targetStaff.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Can only transfer to staff or admin");
        }
        // Check target staff capacity
        const targetStatus = await prisma_1.default.staffStatus.findUnique({
            where: { staffId: toStaffId }
        });
        if (targetStatus && targetStatus.activeChats >= targetStatus.maxChats) {
            throw new BadRequestError_1.BadRequestError("Target staff has reached maximum concurrent chats");
        }
        // Perform transfer in transaction
        const result = await prisma_1.default.$transaction(async (tx) => {
            // Add transfer to history
            const transferHistory = request.transferHistory || [];
            transferHistory.push({
                fromStaffId,
                toStaffId,
                reason,
                transferredAt: new Date().toISOString()
            });
            // Update request
            const updatedRequest = await tx.chatRequest.update({
                where: { id: requestId },
                data: {
                    assignedStaffId: toStaffId,
                    assignedAt: new Date(),
                    transferHistory
                }
            });
            // Update session
            await tx.chatSession.update({
                where: { id: request.sessionId },
                data: {
                    assignedToId: toStaffId,
                    status: client_1.ChatSessionStatus.TRANSFERRED
                }
            });
            // Remove old staff from participants
            await tx.chatParticipant.updateMany({
                where: {
                    sessionId: request.sessionId,
                    userId: fromStaffId
                },
                data: {
                    isActive: false,
                    leftAt: new Date()
                }
            });
            // Add new staff as participant
            await tx.chatParticipant.create({
                data: {
                    sessionId: request.sessionId,
                    userId: toStaffId,
                    role: this.getRoleString(targetStaff.role),
                    isActive: true
                }
            });
            // Update old staff status
            await tx.staffStatus.updateMany({
                where: { staffId: fromStaffId },
                data: {
                    activeChats: { decrement: 1 },
                    isAvailable: true
                }
            });
            // Update new staff status
            await tx.staffStatus.upsert({
                where: { staffId: toStaffId },
                update: {
                    activeChats: { increment: 1 },
                    isAvailable: false
                },
                create: {
                    staffId: toStaffId,
                    isOnline: true,
                    isAvailable: false,
                    activeChats: 1
                }
            });
            // Restore session status
            await tx.chatSession.update({
                where: { id: request.sessionId },
                data: { status: client_1.ChatSessionStatus.ACTIVE }
            });
            return updatedRequest;
        });
        logger_1.default.info(`Support request ${request.requestNumber} transferred from ${fromStaffId} to ${toStaffId}`);
        return result;
    }
    /**
     * Resolve a support request
     */
    static async resolveRequest(requestId, staffId, resolutionNote) {
        const request = await prisma_1.default.chatRequest.findUnique({
            where: { id: requestId },
            include: {
                session: true
            }
        });
        if (!request) {
            throw new NotFoundError_1.NotFoundError("Support request not found");
        }
        if (request.assignedStaffId !== staffId) {
            throw new ForbiddenError_1.ForbiddenError("You are not assigned to this request");
        }
        if (request.status !== client_1.ChatRequestStatus.ASSIGNED) {
            throw new BadRequestError_1.BadRequestError(`Cannot resolve request with status ${request.status}`);
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            // Update request
            const updatedRequest = await tx.chatRequest.update({
                where: { id: requestId },
                data: {
                    status: client_1.ChatRequestStatus.RESOLVED,
                    resolvedAt: new Date(),
                    resolutionNote: resolutionNote || null
                }
            });
            // End session
            await tx.chatSession.update({
                where: { id: request.sessionId },
                data: {
                    status: client_1.ChatSessionStatus.ENDED,
                    endedAt: new Date(),
                    endedBy: staffId
                }
            });
            // Update staff status
            await tx.staffStatus.updateMany({
                where: { staffId },
                data: {
                    activeChats: { decrement: 1 },
                    isAvailable: true
                }
            });
            // Mark all participants inactive
            await tx.chatParticipant.updateMany({
                where: { sessionId: request.sessionId },
                data: {
                    isActive: false,
                    leftAt: new Date()
                }
            });
            return updatedRequest;
        });
        logger_1.default.info(`Support request ${request.requestNumber} resolved by ${staffId}`);
        return result;
    }
    /**
     * Cancel a support request (by user)
     */
    static async cancelRequest(requestId, userId) {
        const request = await prisma_1.default.chatRequest.findUnique({
            where: { id: requestId },
            include: { session: true }
        });
        if (!request) {
            throw new NotFoundError_1.NotFoundError("Support request not found");
        }
        if (request.userId !== userId) {
            throw new ForbiddenError_1.ForbiddenError("You can only cancel your own requests");
        }
        if (request.status === client_1.ChatRequestStatus.RESOLVED || request.status === client_1.ChatRequestStatus.CANCELLED) {
            throw new BadRequestError_1.BadRequestError(`Cannot cancel a ${request.status.toLowerCase()} request`);
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            // Update request
            const updatedRequest = await tx.chatRequest.update({
                where: { id: requestId },
                data: {
                    status: client_1.ChatRequestStatus.CANCELLED,
                    cancelledAt: new Date()
                }
            });
            // End session
            await tx.chatSession.update({
                where: { id: request.sessionId },
                data: {
                    status: client_1.ChatSessionStatus.ENDED,
                    endedAt: new Date(),
                    endedBy: userId
                }
            });
            // If staff was assigned, free them up
            if (request.assignedStaffId) {
                await tx.staffStatus.updateMany({
                    where: { staffId: request.assignedStaffId },
                    data: {
                        activeChats: { decrement: 1 },
                        isAvailable: true
                    }
                });
            }
            // Mark all participants inactive
            await tx.chatParticipant.updateMany({
                where: { sessionId: request.sessionId },
                data: {
                    isActive: false,
                    leftAt: new Date()
                }
            });
            return updatedRequest;
        });
        logger_1.default.info(`Support request ${request.requestNumber} cancelled by user ${userId}`);
        return result;
    }
    /**
     * Get user's chat sessions
     */
    static async getUserChatSessions(userId, filters) {
        const { type, status, page = 1, limit = 20 } = filters || {};
        const skip = (page - 1) * limit;
        const where = {
            participants: {
                some: {
                    userId,
                    isActive: true
                }
            }
        };
        if (type)
            where.type = type;
        if (status)
            where.status = status;
        const [sessions, total] = await Promise.all([
            prisma_1.default.chatSession.findMany({
                where,
                skip,
                take: limit,
                orderBy: { lastMessageAt: 'desc' },
                include: {
                    participants: {
                        where: { isActive: true },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    email: true,
                                    avatar: true,
                                    role: true
                                }
                            }
                        }
                    },
                    property: {
                        select: { id: true, name: true, address: true }
                    },
                    request: {
                        select: {
                            id: true,
                            requestNumber: true,
                            status: true,
                            priority: true,
                            assignedStaffId: true
                        }
                    },
                    _count: {
                        select: {
                            messages: {
                                where: { isRead: false }
                            }
                        }
                    }
                }
            }),
            prisma_1.default.chatSession.count({ where })
        ]);
        return {
            sessions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    /**
     * Get chat session by ID
     */
    static async getChatSessionById(sessionId, userId, role) {
        const session = await prisma_1.default.chatSession.findUnique({
            where: { id: sessionId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                avatar: true,
                                role: true
                            }
                        }
                    }
                },
                property: {
                    select: { id: true, name: true, address: true, city: true, state: true }
                },
                request: {
                    include: {
                        assignedStaff: {
                            select: { id: true, fullName: true, email: true, avatar: true }
                        }
                    }
                },
                messages: {
                    take: 50,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        sender: {
                            select: { id: true, fullName: true, avatar: true, role: true }
                        }
                    }
                }
            }
        });
        if (!session) {
            throw new NotFoundError_1.NotFoundError("Chat session not found");
        }
        // Check if user is a participant or admin
        const isParticipant = session.participants.some(p => p.userId === userId && p.isActive);
        const isAdmin = role === client_1.Role.ADMIN;
        if (!isParticipant && !isAdmin) {
            throw new ForbiddenError_1.ForbiddenError("You don't have access to this chat session");
        }
        return session;
    }
    /**
     * Get pending support requests (for staff/admin)
     */
    static async getPendingRequests(filters) {
        const { status, priority, page = 1, limit = 20 } = filters || {};
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        const [requests, total, pendingCount, assignedCount] = await Promise.all([
            prisma_1.default.chatRequest.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { priority: 'desc' },
                    { createdAt: 'asc' }
                ],
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                            avatar: true,
                            role: true
                        }
                    },
                    assignedStaff: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            avatar: true
                        }
                    },
                    session: {
                        select: {
                            id: true,
                            sessionNumber: true,
                            agoraChannel: true,
                            status: true
                        }
                    }
                }
            }),
            prisma_1.default.chatRequest.count({ where }),
            prisma_1.default.chatRequest.count({ where: { status: client_1.ChatRequestStatus.PENDING } }),
            prisma_1.default.chatRequest.count({ where: { status: client_1.ChatRequestStatus.ASSIGNED } })
        ]);
        return {
            requests,
            counts: {
                pending: pendingCount,
                assigned: assignedCount,
                total
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    /**
     * Set staff status (online/offline/available)
     */
    static async setStaffStatus(staffId, data) {
        const status = await prisma_1.default.staffStatus.upsert({
            where: { staffId },
            update: {
                ...data,
                lastSeen: new Date()
            },
            create: {
                staffId,
                isOnline: data.isOnline ?? true,
                isAvailable: data.isAvailable ?? true,
                maxChats: data.maxChats ?? 3,
                socketId: data.socketId,
                lastSeen: new Date()
            }
        });
        return status;
    }
    /**
     * Get available staff for assignment
     */
    static async getAvailableStaff() {
        const staffList = await prisma_1.default.staffStatus.findMany({
            where: {
                isOnline: true,
                isAvailable: true
            },
            include: {
                staff: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        avatar: true,
                        department: true,
                        employeeId: true
                    }
                }
            },
            orderBy: { activeChats: 'asc' }
        });
        // Filter out those who have reached max capacity
        return staffList.filter(s => s.activeChats < s.maxChats);
    }
    /**
     * Generate Agora token for a chat session
     */
    static async generateSessionToken(sessionId, userId) {
        const session = await prisma_1.default.chatSession.findUnique({
            where: { id: sessionId },
            include: {
                participants: true
            }
        });
        if (!session) {
            throw new NotFoundError_1.NotFoundError("Chat session not found");
        }
        // Verify user is a participant
        const isParticipant = session.participants.some(p => p.userId === userId);
        if (!isParticipant) {
            throw new ForbiddenError_1.ForbiddenError("You are not a participant in this chat");
        }
        // Generate Agora token
        const agoraUserId = `user_${userId}`;
        const token = agora_service_1.AgoraService.generateChatToken(agoraUserId, 86400);
        // Also generate RTC token for voice/video calls
        const rtcToken = agora_service_1.AgoraService.generateRTCToken(session.agoraChannel, agoraUserId, 'publisher', 3600);
        return {
            sessionId: session.id,
            agoraChannel: session.agoraChannel,
            agoraUserId,
            chatToken: token,
            rtcToken,
            expiresIn: 86400
        };
    }
}
exports.ChatSessionService = ChatSessionService;
