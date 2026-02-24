"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.answerCall = exports.endCall = exports.startCall = exports.addReaction = exports.editMessage = exports.deleteMessage = exports.markMessagesAsRead = exports.createMessage = exports.getAvailableChatUsers = exports.getCompanyUsersForVet = exports.removeParticipant = exports.addParticipants = exports.deleteConversation = exports.updateConversation = exports.getConversation = exports.createConversation = exports.getMessages = exports.getConversations = exports.getVetRequests = exports.rejectVetRequest = exports.acceptVetRequest = exports.sendVetRequest = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const BadRequestError_1 = require("../errors/BadRequestError");
const notification_services_1 = require("../services/notification.services");
const message_services_1 = require("../services/message.services");
const sendVetRequest = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const adminRole = req.user.role;
        const { vetId, companyId } = req.params;
        const { message } = req.body;
        if (adminRole !== 'ADMIN') {
            throw new ForbiddenError_1.ForbiddenError('Only admin can send vet requests');
        }
        // Verify vet exists
        const vet = await prisma_1.default.user.findUnique({
            where: {
                id: vetId,
                role: 'VET',
                isVerified: true,
                isSuspended: false
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                bio: true,
                specializations: true,
                licenseNumber: true,
                averageRating: true,
                availability: true
            }
        });
        if (!vet) {
            throw new NotFoundError_1.NotFoundError('Vet not found or not available');
        }
        // Verify company exists
        const company = await prisma_1.default.company.findUnique({
            where: { id: companyId }
        });
        if (!company) {
            throw new NotFoundError_1.NotFoundError('Company not found');
        }
        // Check if admin belongs to the company
        const admin = await prisma_1.default.user.findUnique({
            where: {
                id: adminId,
                companyId: companyId,
                role: 'ADMIN'
            }
        });
        if (!admin) {
            throw new ForbiddenError_1.ForbiddenError('You do not have permission to send requests for this company');
        }
        // Check if request already exists
        const existingRequest = await prisma_1.default.vetRequest.findFirst({
            where: {
                vetId,
                companyId,
                status: { in: ['PENDING', 'ACCEPTED'] }
            }
        });
        if (existingRequest) {
            throw new BadRequestError_1.BadRequestError('Request already sent to this vet');
        }
        // Create vet request
        const vetRequest = await prisma_1.default.vetRequest.create({
            data: {
                vetId,
                companyId,
                adminId,
                message: message || `Invitation to collaborate with ${company.name}`,
                status: 'PENDING'
            },
            include: {
                vet: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        bio: true,
                        specializations: true,
                        averageRating: true
                    }
                },
                company: {
                    select: {
                        id: true,
                        name: true,
                        location: true,
                        phone: true
                    }
                },
                admin: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });
        await notification_services_1.NotificationService.createNotification({
            title: 'New Collaboration Request',
            message: `${company.name} wants to collaborate with you`,
            type: 'VET_REQUEST',
            status: 'UNREAD',
            recipientId: vetId,
            relatedEntityType: 'VET_REQUEST',
            relatedEntityId: vetRequest.id,
            metadata: {
                requestId: vetRequest.id,
                companyName: company.name,
                adminName: admin.fullName,
                message: vetRequest.message,
                timestamp: new Date().toISOString()
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Vet request sent successfully', { vetRequest }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.sendVetRequest = sendVetRequest;
const acceptVetRequest = async (req, res, next) => {
    try {
        const vetId = req.user.id;
        const vetRole = req.user.role;
        const { requestId } = req.params;
        if (vetRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only vets can accept requests');
        }
        const vetRequest = await prisma_1.default.vetRequest.findUnique({
            where: {
                id: requestId,
                vetId,
                status: 'PENDING'
            },
            include: {
                company: {
                    include: {
                        users: {
                            where: {
                                role: { in: ['ADMIN', 'FARM_KEEPER', 'COWORKER'] },
                                isSuspended: false
                            },
                            select: {
                                id: true,
                                fullName: true,
                                role: true
                            }
                        }
                    }
                }
            }
        });
        if (!vetRequest) {
            throw new NotFoundError_1.NotFoundError('Request not found or already processed');
        }
        // Update request status
        const updatedRequest = await prisma_1.default.vetRequest.update({
            where: { id: requestId },
            data: {
                status: 'ACCEPTED',
                acceptedAt: new Date()
            }
        });
        // Create conversations between vet and company members
        const conversationPromises = vetRequest.company.users.map(async (user) => {
            // Check if conversation already exists
            const existingConversation = await prisma_1.default.conversation.findFirst({
                where: {
                    AND: [
                        { participants: { some: { userId: vetId } } },
                        { participants: { some: { userId: user.id } } },
                        { isGroup: false }
                    ]
                }
            });
            if (existingConversation) {
                return existingConversation;
            }
            // Create new conversation
            return await prisma_1.default.conversation.create({
                data: {
                    participants: {
                        create: [
                            { userId: vetId },
                            { userId: user.id }
                        ]
                    },
                    isGroup: false
                }
            });
        });
        const conversations = await Promise.all(conversationPromises);
        // Notify company members
        const notificationPromises = vetRequest.company.users.map(async (user) => {
            await notification_services_1.NotificationService.createNotification({
                title: 'Vet Request Accepted',
                message: `${req.user.fullName} has accepted your collaboration request`,
                type: 'VET_REQUEST',
                status: 'UNREAD',
                recipientId: user.id,
                relatedEntityType: 'VET_REQUEST',
                relatedEntityId: requestId,
                metadata: {
                    requestId: requestId,
                    vetName: req.user.fullName,
                    companyName: vetRequest.company.name,
                    timestamp: new Date().toISOString()
                }
            });
        });
        await Promise.all(notificationPromises);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Request accepted successfully', {
            vetRequest: updatedRequest,
            conversationsCreated: conversations.length
        });
    }
    catch (error) {
        next(error);
    }
};
exports.acceptVetRequest = acceptVetRequest;
const rejectVetRequest = async (req, res, next) => {
    try {
        const vetId = req.user.id;
        const vetRole = req.user.role;
        const { requestId } = req.params;
        const { reason } = req.body;
        if (vetRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only vets can reject requests');
        }
        const vetRequest = await prisma_1.default.vetRequest.findUnique({
            where: {
                id: requestId,
                vetId,
                status: 'PENDING'
            },
            include: {
                admin: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                },
                company: {
                    select: {
                        name: true
                    }
                }
            }
        });
        if (!vetRequest) {
            throw new NotFoundError_1.NotFoundError('Request not found or already processed');
        }
        // Update request status
        const updatedRequest = await prisma_1.default.vetRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                rejectedAt: new Date()
            }
        });
        // Notify admin
        await notification_services_1.NotificationService.createNotification({
            title: 'Vet Request Rejected',
            message: `${req.user.fullName} has rejected your collaboration request${reason ? `: ${reason}` : ''}`,
            type: 'VET_REQUEST',
            status: 'UNREAD',
            recipientId: vetRequest.admin.id,
            relatedEntityType: 'VET_REQUEST',
            relatedEntityId: requestId,
            metadata: {
                requestId: requestId,
                vetName: req.user.fullName,
                companyName: vetRequest.company.name,
                reason: reason || null,
                timestamp: new Date().toISOString()
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Request rejected successfully', {
            vetRequest: updatedRequest
        });
    }
    catch (error) {
        next(error);
    }
};
exports.rejectVetRequest = rejectVetRequest;
const getVetRequests = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { page = 1, limit = 10, status } = req.query;
        const where = {};
        if (userRole === 'VET') {
            where.vetId = userId;
        }
        else if (userRole === 'ADMIN') {
            where.adminId = userId;
        }
        else {
            throw new ForbiddenError_1.ForbiddenError('Only admins and vets can view vet requests');
        }
        if (status)
            where.status = String(status);
        const [requests, total] = await Promise.all([
            prisma_1.default.vetRequest.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: {
                    vet: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                            bio: true,
                            specializations: true,
                            averageRating: true,
                            availability: true,
                            avatar: true
                        }
                    },
                    company: {
                        select: {
                            id: true,
                            name: true,
                            location: true
                        }
                    },
                    admin: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma_1.default.vetRequest.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Vet requests retrieved successfully', {
            requests,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVetRequests = getVetRequests;
const getConversations = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const conversations = await prisma_1.default.conversation.findMany({
            where: {
                participants: {
                    some: { userId }
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                avatar: true,
                                role: true,
                                phone: true,
                                email: true,
                                companyName: true,
                                availability: true
                            }
                        }
                    }
                },
                lastMessage: {
                    select: {
                        id: true,
                        content: true,
                        messageType: true,
                        senderId: true,
                        createdAt: true,
                        status: true
                    }
                },
                _count: {
                    select: {
                        messages: {
                            where: {
                                NOT: {
                                    senderId: userId
                                },
                                isRead: false
                            }
                        }
                    }
                }
            },
            orderBy: {
                lastMessageAt: 'desc'
            },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit)
        });
        const total = await prisma_1.default.conversation.count({
            where: {
                participants: {
                    some: { userId }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Conversations retrieved successfully', {
            conversations,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getConversations = getConversations;
const getMessages = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { before, limit = 50 } = req.query;
        // Verify user is part of conversation
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: { userId }
                }
            }
        });
        if (!conversation) {
            throw new ForbiddenError_1.ForbiddenError('You are not part of this conversation');
        }
        const where = {
            conversationId
        };
        if (before) {
            where.createdAt = { lt: new Date(before) };
        }
        const messages = await prisma_1.default.message.findMany({
            where,
            include: {
                sender: {
                    select: {
                        id: true,
                        fullName: true,
                        avatar: true,
                        role: true
                    }
                },
                parentMessage: {
                    select: {
                        id: true,
                        content: true,
                        sender: {
                            select: {
                                id: true,
                                fullName: true
                            }
                        }
                    }
                },
                reactions: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: Number(limit)
        });
        // Mark messages as read
        const messageIds = messages.map(m => m.id);
        await prisma_1.default.message.updateMany({
            where: {
                id: { in: messageIds },
                senderId: { not: userId }
            },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });
        await prisma_1.default.messageDelivery.updateMany({
            where: {
                messageId: { in: messageIds },
                recipientId: userId
            },
            data: {
                status: 'READ',
                readAt: new Date()
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Messages retrieved successfully', {
            messages: messages.reverse(),
            hasMore: messages.length === Number(limit)
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMessages = getMessages;
const createConversation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { participantIds, isGroup, groupName, groupImage } = req.body;
        if (!participantIds || participantIds.length === 0) {
            throw new BadRequestError_1.BadRequestError('At least one participant is required');
        }
        // Add current user to participants
        const allParticipantIds = [...new Set([userId, ...participantIds])];
        // Check if conversation already exists (for non-group chats)
        if (!isGroup && allParticipantIds.length === 2) {
            const existingConversation = await prisma_1.default.conversation.findFirst({
                where: {
                    AND: [
                        { participants: { some: { userId: allParticipantIds[0] } } },
                        { participants: { some: { userId: allParticipantIds[1] } } },
                        { isGroup: false }
                    ]
                }
            });
            if (existingConversation) {
                (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Conversation already exists', {
                    conversation: existingConversation
                });
            }
        }
        // Create conversation
        const conversation = await prisma_1.default.conversation.create({
            data: {
                isGroup: isGroup || false,
                groupName: isGroup ? groupName : null,
                groupImage: isGroup ? groupImage : null,
                groupAdminId: isGroup ? userId : null,
                participants: {
                    create: allParticipantIds.map(id => ({
                        userId: id
                    }))
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                avatar: true,
                                role: true,
                                phone: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Conversation created successfully', {
            conversation
        }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createConversation = createConversation;
const getConversation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: { userId }
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                avatar: true,
                                role: true,
                                phone: true,
                                email: true,
                                companyName: true,
                                availability: true
                            }
                        }
                    }
                },
                lastMessage: {
                    select: {
                        id: true,
                        content: true,
                        messageType: true,
                        senderId: true,
                        createdAt: true
                    }
                }
            }
        });
        if (!conversation) {
            throw new NotFoundError_1.NotFoundError('Conversation not found');
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Conversation retrieved successfully', {
            conversation
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getConversation = getConversation;
const updateConversation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { groupName, groupImage } = req.body;
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: { userId }
                },
                isGroup: true,
                groupAdminId: userId
            }
        });
        if (!conversation) {
            throw new NotFoundError_1.NotFoundError('Conversation not found or you are not the admin');
        }
        const updatedConversation = await prisma_1.default.conversation.update({
            where: { id: conversationId },
            data: {
                ...(groupName && { groupName }),
                ...(groupImage && { groupImage })
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                avatar: true,
                                role: true
                            }
                        }
                    }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Conversation updated successfully', {
            conversation: updatedConversation
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateConversation = updateConversation;
const deleteConversation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: { userId }
                }
            }
        });
        if (!conversation) {
            throw new NotFoundError_1.NotFoundError('Conversation not found');
        }
        // Soft delete by removing user from participants
        await prisma_1.default.conversationParticipant.deleteMany({
            where: {
                conversationId,
                userId
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Conversation deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteConversation = deleteConversation;
const addParticipants = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { participantIds } = req.body;
        if (!participantIds || participantIds.length === 0) {
            throw new BadRequestError_1.BadRequestError('At least one participant is required');
        }
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                isGroup: true,
                participants: {
                    some: { userId }
                }
            }
        });
        if (!conversation) {
            throw new NotFoundError_1.NotFoundError('Conversation not found or not a group');
        }
        // Add participants
        const addedParticipants = await Promise.all(participantIds.map(async (participantId) => {
            // Check if already a participant
            const existing = await prisma_1.default.conversationParticipant.findUnique({
                where: {
                    conversationId_userId: {
                        conversationId,
                        userId: participantId
                    }
                }
            });
            if (existing) {
                return existing;
            }
            return await prisma_1.default.conversationParticipant.create({
                data: {
                    conversationId,
                    userId: participantId
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            avatar: true,
                            role: true
                        }
                    }
                }
            });
        }));
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Participants added successfully', {
            participants: addedParticipants
        });
    }
    catch (error) {
        next(error);
    }
};
exports.addParticipants = addParticipants;
const removeParticipant = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { conversationId, participantId } = req.params;
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                isGroup: true,
                participants: {
                    some: { userId }
                }
            }
        });
        if (!conversation) {
            throw new NotFoundError_1.NotFoundError('Conversation not found or not a group');
        }
        // Can't remove yourself unless you're leaving the group
        if (participantId !== userId) {
            // Check if user has permission (admin or removing yourself)
            const isAdmin = conversation.groupAdminId === userId;
            if (!isAdmin) {
                throw new ForbiddenError_1.ForbiddenError('Only group admin can remove participants');
            }
        }
        await prisma_1.default.conversationParticipant.delete({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId: participantId
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Participant removed successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.removeParticipant = removeParticipant;
const getCompanyUsersForVet = async (req, res, next) => {
    try {
        const vetId = req.user.id;
        const vetRole = req.user.role;
        if (vetRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only veterinarians can access this resource');
        }
        const acceptedVetRequests = await prisma_1.default.vetRequest.findMany({
            where: {
                vetId,
                status: 'ACCEPTED'
            },
            select: {
                companyId: true
            }
        });
        const companyIds = [...new Set(acceptedVetRequests.map(r => r.companyId))];
        if (companyIds.length === 0) {
            (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'No accepted company requests found', {
                allUsers: []
            });
        }
        const companyUsers = await prisma_1.default.user.findMany({
            where: {
                companyId: { in: companyIds },
                isSuspended: false,
                isVerified: true,
                role: {
                    in: ['ADMIN', 'COWORKER', 'FARM_KEEPER']
                }
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                avatar: true,
                role: true,
                companyId: true,
                companyName: true,
                location: true,
                lastLogin: true
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Available company users retrieved successfully', {
            allUsers: companyUsers,
            companyCount: companyIds.length
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCompanyUsersForVet = getCompanyUsersForVet;
const getAvailableChatUsers = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const companyId = req.user.companyId;
        if (!companyId) {
            throw new ForbiddenError_1.ForbiddenError('User is not associated with a company');
        }
        // Get company members
        const companyUsers = await prisma_1.default.user.findMany({
            where: {
                companyId,
                isSuspended: false,
                isVerified: true,
                id: { not: userId }
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                avatar: true,
                role: true,
                companyName: true,
                location: true,
                lastLogin: true
            }
        });
        const acceptedVetRequests = await prisma_1.default.vetRequest.findMany({
            where: {
                companyId,
                status: 'ACCEPTED'
            },
            select: {
                vetId: true
            }
        });
        const vetIds = acceptedVetRequests.map(r => r.vetId);
        const acceptedVets = await prisma_1.default.user.findMany({
            where: {
                id: { in: vetIds },
                isSuspended: false,
                isVerified: true
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                avatar: true,
                role: true,
                companyName: true,
                location: true,
                bio: true,
                specializations: true,
                lastLogin: true
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Available users retrieved successfully', {
            allUsers: [...companyUsers, ...acceptedVets]
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailableChatUsers = getAvailableChatUsers;
// Create message endpoint
const createMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { conversationId, content, messageType = 'TEXT', mediaUrl, fileName, fileSize, parentMessageId } = req.body;
        // Verify conversation and permissions
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: { userId }
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                avatar: true
                            }
                        }
                    }
                }
            }
        });
        if (!conversation) {
            throw new ForbiddenError_1.ForbiddenError('Not authorized to send message in this conversation');
        }
        // Create message
        const message = await prisma_1.default.message.create({
            data: {
                conversationId,
                senderId: userId,
                content,
                messageType,
                mediaUrl,
                fileName,
                fileSize,
                parentMessageId,
                status: 'SENT'
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        fullName: true,
                        avatar: true,
                        role: true
                    }
                },
                parentMessage: {
                    select: {
                        id: true,
                        content: true,
                        sender: {
                            select: {
                                id: true,
                                fullName: true
                            }
                        }
                    }
                }
            }
        });
        // Update conversation last message
        await prisma_1.default.conversation.update({
            where: { id: conversationId },
            data: {
                lastMessageId: message.id,
                lastMessageAt: new Date(),
                updatedAt: new Date()
            }
        });
        // Create deliveries for recipients
        const recipients = conversation.participants
            .filter(p => p.userId !== userId)
            .map(p => p.user);
        await Promise.all(recipients.map(recipient => prisma_1.default.messageDelivery.create({
            data: {
                messageId: message.id,
                recipientId: recipient.id,
                status: 'SENT'
            }
        })));
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Message sent successfully', {
            message,
            recipients: recipients.map(recipient => ({ id: recipient.id, fullName: recipient.fullName }))
        }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createMessage = createMessage;
const markMessagesAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { messageIds, conversationId } = req.body;
        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            throw new BadRequestError_1.BadRequestError('Message IDs are required');
        }
        // Verify user is part of the conversation
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: { userId }
                }
            }
        });
        if (!conversation) {
            throw new ForbiddenError_1.ForbiddenError('Not authorized to mark messages as read in this conversation');
        }
        // Use MessageService for consistency
        await message_services_1.MessageService.markMessagesAsRead(messageIds, userId);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Messages marked as read successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.markMessagesAsRead = markMessagesAsRead;
const deleteMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { deleteForEveryone = false } = req.body;
        const result = await message_services_1.MessageService.deleteMessage(messageId, userId, deleteForEveryone);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, deleteForEveryone ? 'Message deleted for everyone' : 'Message deleted for you', {
            ...result
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteMessage = deleteMessage;
const editMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { content } = req.body;
        if (!content || content.trim() === '') {
            throw new BadRequestError_1.BadRequestError('Message content is required');
        }
        const message = await message_services_1.MessageService.editMessage(messageId, userId, content.trim());
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Message updated successfully', {
            message
        });
    }
    catch (error) {
        next(error);
    }
};
exports.editMessage = editMessage;
const addReaction = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { emoji } = req.body;
        if (!emoji || emoji.trim() === '') {
            throw new BadRequestError_1.BadRequestError('Emoji is required');
        }
        const reaction = await message_services_1.MessageService.addReaction(messageId, userId, emoji.trim());
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Reaction added successfully', { reaction });
    }
    catch (error) {
        next(error);
    }
};
exports.addReaction = addReaction;
const startCall = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { conversationId, callType = 'audio' } = req.body;
        const call = await message_services_1.MessageService.startCall(conversationId, userId, callType);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Call started successfully', { call }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.startCall = startCall;
const endCall = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { callId } = req.params;
        const { reason } = req.body;
        const call = await message_services_1.MessageService.endCall(callId, userId, reason);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Call ended successfully', { call });
    }
    catch (error) {
        next(error);
    }
};
exports.endCall = endCall;
const answerCall = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { callId } = req.params;
        const { accept } = req.body;
        const result = await message_services_1.MessageService.answerCall(callId, userId, accept);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, accept ? 'Call accepted' : 'Call declined', {
            accepted: result.accepted,
            call: result.call
        });
    }
    catch (error) {
        next(error);
    }
};
exports.answerCall = answerCall;
