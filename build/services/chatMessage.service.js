"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageService = void 0;
// services/chatMessage.service.ts
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const BadRequestError_1 = require("../errors/BadRequestError");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const logger_1 = __importDefault(require("../config/logger"));
const notification_service_1 = require("./notification.service");
const encryption_service_1 = require("./encryption.service");
class ChatMessageService {
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
     * Save a message with encryption
     */
    static async saveMessage(sessionId, senderId, content, messageType = 'text', agoraMsgId, metadata) {
        // Verify session and sender
        const session = await prisma_1.default.chatSession.findUnique({
            where: { id: sessionId },
            include: {
                participants: {
                    where: { isActive: true },
                    include: {
                        user: {
                            select: { id: true, fullName: true, email: true }
                        }
                    }
                }
            }
        });
        if (!session) {
            throw new NotFoundError_1.NotFoundError("Chat session not found");
        }
        if (session.status !== 'ACTIVE') {
            throw new BadRequestError_1.BadRequestError("Cannot send messages to an inactive chat session");
        }
        const sender = await prisma_1.default.user.findUnique({
            where: { id: senderId },
            select: { id: true, role: true, fullName: true }
        });
        if (!sender) {
            throw new NotFoundError_1.NotFoundError("Sender not found");
        }
        const isParticipant = session.participants.some(p => p.userId === senderId);
        if (!isParticipant) {
            throw new ForbiddenError_1.ForbiddenError("You are not a participant in this chat");
        }
        // ✅ Encrypt the content
        const encryptedContent = await encryption_service_1.EncryptionService.encrypt(content);
        const contentHash = encryption_service_1.EncryptionService.generateSearchHash(content);
        // ✅ Encrypt metadata if provided
        let encryptedMetadata = null;
        if (metadata) {
            const metadataEncrypted = await encryption_service_1.EncryptionService.encryptMetadata(metadata);
            encryptedMetadata = metadataEncrypted;
        }
        // Create message with encryption
        const message = await prisma_1.default.chatMessage.create({
            data: {
                sessionId,
                senderId,
                senderRole: this.getRoleString(sender.role),
                // ✅ Encrypted content
                content: encryptedContent.ciphertext,
                iv: encryptedContent.iv,
                authTag: encryptedContent.authTag,
                encryptedKey: encryptedContent.keyId,
                // ✅ Encrypted metadata
                metadata: encryptedMetadata?.ciphertext || null,
                metadataIv: encryptedMetadata?.iv || null,
                metadataAuthTag: encryptedMetadata?.authTag || null,
                // Search hash for exact matches
                contentHash,
                messageType,
                agoraMsgId
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        fullName: true,
                        avatar: true,
                        role: true
                    }
                }
            }
        });
        // Update session
        await prisma_1.default.chatSession.update({
            where: { id: sessionId },
            data: {
                lastMessage: content.length > 100 ? content.substring(0, 100) + '...' : content,
                lastMessageAt: new Date()
            }
        });
        // Notify other participants
        const otherParticipants = session.participants.filter(p => p.userId !== senderId);
        for (const participant of otherParticipants) {
            try {
                await notification_service_1.NotificationService.sendToUser(participant.userId, {
                    title: `New message from ${sender.fullName}`,
                    message: content.length > 50 ? content.substring(0, 50) + '...' : content,
                    type: 'GENERAL',
                    channel: 'IN_APP',
                    priority: 'NORMAL',
                    data: {
                        sessionId,
                        messageId: message.id,
                        senderId,
                        type: 'chat_message'
                    }
                });
            }
            catch (error) {
                logger_1.default.error(`Failed to notify participant ${participant.userId}:`, error);
            }
        }
        // ✅ Return decrypted message
        return {
            ...message,
            content, // Return decrypted
            metadata: metadata || null,
            // Don't expose encryption details to client
            iv: undefined,
            authTag: undefined,
            encryptedKey: undefined,
            metadataIv: undefined,
            metadataAuthTag: undefined,
            contentHash: undefined
        };
    }
    /**
     * Get messages with decryption
     */
    static async getSessionMessages(sessionId, userId, role, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const session = await prisma_1.default.chatSession.findUnique({
            where: { id: sessionId },
            include: {
                participants: true
            }
        });
        if (!session) {
            throw new NotFoundError_1.NotFoundError("Chat session not found");
        }
        const isParticipant = session.participants.some(p => p.userId === userId);
        const isAdmin = role === client_1.Role.ADMIN;
        if (!isParticipant && !isAdmin) {
            throw new ForbiddenError_1.ForbiddenError("You don't have access to this chat session");
        }
        const [messages, total] = await Promise.all([
            prisma_1.default.chatMessage.findMany({
                where: {
                    sessionId,
                    isDeleted: false
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    sender: {
                        select: {
                            id: true,
                            fullName: true,
                            avatar: true,
                            role: true
                        }
                    }
                }
            }),
            prisma_1.default.chatMessage.count({
                where: {
                    sessionId,
                    isDeleted: false
                }
            })
        ]);
        // ✅ Decrypt all messages
        const decryptedMessages = await Promise.all(messages.map(async (msg) => {
            try {
                const content = await encryption_service_1.EncryptionService.decrypt({
                    ciphertext: msg.content,
                    iv: msg.iv,
                    authTag: msg.authTag,
                    keyId: msg.encryptedKey
                });
                let metadata = null;
                if (msg.metadata && msg.metadataIv && msg.metadataAuthTag) {
                    metadata = await encryption_service_1.EncryptionService.decryptMetadata({
                        ciphertext: msg.metadata,
                        iv: msg.metadataIv,
                        authTag: msg.metadataAuthTag,
                        keyId: msg.encryptedKey
                    });
                }
                return {
                    id: msg.id,
                    sessionId: msg.sessionId,
                    senderId: msg.senderId,
                    senderRole: msg.senderRole,
                    content, // ✅ Decrypted
                    messageType: msg.messageType,
                    metadata, // ✅ Decrypted
                    isRead: msg.isRead,
                    readAt: msg.readAt,
                    createdAt: msg.createdAt,
                    updatedAt: msg.updatedAt,
                    sender: msg.sender
                };
            }
            catch (error) {
                logger_1.default.error(`Failed to decrypt message ${msg.id}:`, error);
                return {
                    id: msg.id,
                    sessionId: msg.sessionId,
                    senderId: msg.senderId,
                    senderRole: msg.senderRole,
                    content: '[Unable to decrypt message]',
                    messageType: msg.messageType,
                    metadata: null,
                    isRead: msg.isRead,
                    readAt: msg.readAt,
                    createdAt: msg.createdAt,
                    updatedAt: msg.updatedAt,
                    sender: msg.sender,
                    decryptionError: true
                };
            }
        }));
        // Mark messages as read
        if (isParticipant) {
            await prisma_1.default.chatMessage.updateMany({
                where: {
                    sessionId,
                    senderId: { not: userId },
                    isRead: false
                },
                data: {
                    isRead: true,
                    readAt: new Date()
                }
            });
        }
        return {
            messages: decryptedMessages.reverse(),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    /**
     * Search messages by exact content match (using hash)
     */
    static async searchMessages(sessionId, userId, searchTerm, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        // Verify access
        const session = await prisma_1.default.chatSession.findUnique({
            where: { id: sessionId },
            include: { participants: true }
        });
        if (!session) {
            throw new NotFoundError_1.NotFoundError("Chat session not found");
        }
        const isParticipant = session.participants.some(p => p.userId === userId);
        if (!isParticipant) {
            throw new ForbiddenError_1.ForbiddenError("You don't have access to this chat session");
        }
        // ✅ Search using hash (exact match only, no decryption needed)
        const searchHash = encryption_service_1.EncryptionService.generateSearchHash(searchTerm);
        const [messages, total] = await Promise.all([
            prisma_1.default.chatMessage.findMany({
                where: {
                    sessionId,
                    contentHash: searchHash,
                    isDeleted: false
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    sender: {
                        select: {
                            id: true,
                            fullName: true,
                            avatar: true,
                            role: true
                        }
                    }
                }
            }),
            prisma_1.default.chatMessage.count({
                where: {
                    sessionId,
                    contentHash: searchHash,
                    isDeleted: false
                }
            })
        ]);
        // Decrypt results
        const decryptedMessages = await Promise.all(messages.map(async (msg) => {
            try {
                const content = await encryption_service_1.EncryptionService.decrypt({
                    ciphertext: msg.content,
                    iv: msg.iv,
                    authTag: msg.authTag,
                    keyId: msg.encryptedKey
                });
                return {
                    id: msg.id,
                    content,
                    sender: msg.sender,
                    createdAt: msg.createdAt
                };
            }
            catch (error) {
                return {
                    id: msg.id,
                    content: '[Unable to decrypt]',
                    sender: msg.sender,
                    createdAt: msg.createdAt
                };
            }
        }));
        return {
            messages: decryptedMessages,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    /**
     * Soft delete a message
     */
    static async deleteMessage(messageId, userId, role) {
        const message = await prisma_1.default.chatMessage.findUnique({
            where: { id: messageId }
        });
        if (!message) {
            throw new NotFoundError_1.NotFoundError("Message not found");
        }
        // Only sender or admin can delete
        const canDelete = message.senderId === userId || role === client_1.Role.ADMIN;
        if (!canDelete) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to delete this message");
        }
        // Soft delete
        const updatedMessage = await prisma_1.default.chatMessage.update({
            where: { id: messageId },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                // Overwrite content with empty encrypted string for privacy
                content: '',
                metadata: null
            }
        });
        return updatedMessage;
    }
    /**
     * Mark messages as read
     */
    static async markMessagesAsRead(sessionId, userId) {
        const result = await prisma_1.default.chatMessage.updateMany({
            where: {
                sessionId,
                senderId: { not: userId },
                isRead: false
            },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });
        return { count: result.count };
    }
    /**
     * Get unread message count
     */
    static async getUnreadCount(userId) {
        const count = await prisma_1.default.chatMessage.count({
            where: {
                session: {
                    participants: {
                        some: {
                            userId,
                            isActive: true
                        }
                    }
                },
                senderId: { not: userId },
                isRead: false,
                isDeleted: false
            }
        });
        return count;
    }
}
exports.ChatMessageService = ChatMessageService;
