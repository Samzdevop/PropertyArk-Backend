"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const ForbiddenError_1 = require("../errors/ForbiddenError");
const NotFoundError_1 = require("../errors/NotFoundError");
class MessageService {
    static async createMessage(data, senderId) {
        const { conversationId, content, messageType = 'TEXT', mediaUrl, fileName, fileSize, messageId, encryptedKey, parentMessageId } = data;
        // Verify conversation and permissions
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: { userId: senderId }
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
                senderId,
                content,
                messageType: messageType,
                mediaUrl,
                fileName,
                fileSize,
                // messageId,
                encryptedKey,
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
            .filter(p => p.userId !== senderId)
            .map(p => p.user);
        await Promise.all(recipients.map(recipient => prisma_1.default.messageDelivery.create({
            data: {
                messageId: message.id,
                recipientId: recipient.id,
                status: 'SENT'
            }
        })));
        return {
            ...message,
            recipients
        };
    }
    static async markMessagesAsRead(messageIds, userId) {
        // Update message deliveries
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
        // Update messages
        await prisma_1.default.message.updateMany({
            where: {
                id: { in: messageIds }
            },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });
    }
    static async deleteMessage(messageId, userId, deleteForEveryone) {
        const message = await prisma_1.default.message.findUnique({
            where: { id: messageId },
            include: {
                conversation: {
                    include: {
                        participants: {
                            select: { userId: true }
                        }
                    }
                }
            }
        });
        if (!message) {
            throw new NotFoundError_1.NotFoundError('Message not found');
        }
        if (!message.conversation.participants.some(p => p.userId === userId)) {
            throw new ForbiddenError_1.ForbiddenError('Not authorized to delete this message');
        }
        if (deleteForEveryone && message.senderId !== userId) {
            throw new ForbiddenError_1.ForbiddenError('Only sender can delete message for everyone');
        }
        if (deleteForEveryone) {
            // Delete for everyone
            await prisma_1.default.message.delete({
                where: { id: messageId }
            });
            return {
                deletedForEveryone: true,
                conversationId: message.conversationId
            };
        }
        else {
            // Delete for me only
            await prisma_1.default.message.update({
                where: { id: messageId },
                data: {
                    deletedForUsers: {
                        connect: { id: userId }
                    }
                }
            });
            return {
                deletedForEveryone: false,
                conversationId: message.conversationId
            };
        }
    }
    static async addReaction(messageId, userId, emoji) {
        // Check if reaction exists
        const existingReaction = await prisma_1.default.reaction.findUnique({
            where: {
                messageId_userId: {
                    messageId,
                    userId
                }
            }
        });
        if (existingReaction) {
            // Update existing reaction
            return await prisma_1.default.reaction.update({
                where: { id: existingReaction.id },
                data: { emoji },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            avatar: true
                        }
                    }
                }
            });
        }
        else {
            // Create new reaction
            return await prisma_1.default.reaction.create({
                data: {
                    messageId,
                    userId,
                    emoji
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            avatar: true
                        }
                    }
                }
            });
        }
    }
    static async editMessage(messageId, userId, newContent) {
        const message = await prisma_1.default.message.findUnique({
            where: { id: messageId }
        });
        if (!message) {
            throw new NotFoundError_1.NotFoundError('Message not found');
        }
        if (message.senderId !== userId) {
            throw new ForbiddenError_1.ForbiddenError('Only sender can edit message');
        }
        return await prisma_1.default.message.update({
            where: { id: messageId },
            data: {
                content: newContent,
                updatedAt: new Date()
            }
        });
    }
    static async startCall(conversationId, initiatorId, callType) {
        const conversation = await prisma_1.default.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: { userId: initiatorId }
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
            throw new ForbiddenError_1.ForbiddenError('Not authorized to start call in this conversation');
        }
        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return await prisma_1.default.call.create({
            data: {
                callId,
                conversationId,
                initiatorId,
                callType,
                status: 'RINGING',
                participants: {
                    create: conversation.participants
                        .filter(p => p.userId !== initiatorId)
                        .map(p => ({
                        userId: p.userId,
                        status: 'RINGING'
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
                                avatar: true
                            }
                        }
                    }
                }
            }
        });
    }
    static async endCall(callId, userId, reason) {
        const call = await prisma_1.default.call.findUnique({
            where: { callId },
            include: {
                conversation: {
                    include: {
                        participants: {
                            select: { userId: true }
                        }
                    }
                }
            }
        });
        if (!call) {
            throw new NotFoundError_1.NotFoundError('Call not found');
        }
        // Update call status
        const endedCall = await prisma_1.default.call.update({
            where: { callId },
            data: {
                status: 'ENDED',
                endedAt: new Date(),
                endReason: reason,
                duration: Math.floor((new Date().getTime() - call.startedAt.getTime()) / 1000)
            },
            include: {
                conversation: {
                    include: {
                        participants: {
                            select: { userId: true }
                        }
                    }
                }
            }
        });
        // Update participant status
        await prisma_1.default.callParticipant.updateMany({
            where: { callId },
            data: {
                status: 'ENDED',
                leftAt: new Date()
            }
        });
        return endedCall;
    }
    static async answerCall(callId, userId, accept) {
        const call = await prisma_1.default.call.findUnique({
            where: { callId },
            include: {
                initiator: {
                    select: { id: true }
                }
            }
        });
        if (!call) {
            throw new NotFoundError_1.NotFoundError('Call not found');
        }
        // Update participant status
        await prisma_1.default.callParticipant.update({
            where: {
                callId_userId: {
                    callId,
                    userId
                }
            },
            data: {
                status: accept ? 'JOINED' : 'DECLINED',
                joinedAt: accept ? new Date() : null
            }
        });
        if (accept) {
            // Update call status if participants joined
            const joinedCount = await prisma_1.default.callParticipant.count({
                where: {
                    callId,
                    status: 'JOINED'
                }
            });
            if (joinedCount > 0) {
                await prisma_1.default.call.update({
                    where: { callId },
                    data: { status: 'ACTIVE' }
                });
            }
        }
        return {
            accepted: accept,
            call
        };
    }
}
exports.MessageService = MessageService;
