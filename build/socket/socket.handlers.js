"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketHandlers = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const message_services_1 = require("../services/message.services");
const redis_1 = require("../config/redis");
const message_queue_1 = require("../queue/message.queue");
class SocketHandlers {
    io;
    connectedUsers;
    constructor(io, connectedUsers) {
        this.io = io;
        this.connectedUsers = connectedUsers;
    }
    async updateUserPresence(userId, isOnline) {
        if (isOnline) {
            await redis_1.PresenceService.setOnline(userId);
        }
        else {
            await redis_1.PresenceService.setOffline(userId);
        }
    }
    async notifyContactsOfStatusChange(userId, status) {
        const contacts = await this.getUserContacts(userId);
        contacts.forEach(contactId => {
            const contactSocketId = this.connectedUsers.get(contactId);
            if (contactSocketId) {
                this.io.to(contactSocketId).emit('user_status', {
                    userId,
                    status,
                    timestamp: new Date()
                });
            }
        });
    }
    async joinUserToConversationRooms(socket, userId) {
        const conversations = await prisma_1.default.conversation.findMany({
            where: {
                participants: {
                    some: { userId }
                }
            },
            select: { id: true }
        });
        conversations.forEach(conversation => {
            socket.join(`conversation:${conversation.id}`);
        });
    }
    async handleSendMessage(socket, data, callback) {
        try {
            const userId = socket.data.user.id;
            const message = await message_services_1.MessageService.createMessage(data, userId);
            // Emit to conversation
            this.io.to(`conversation:${message.conversationId}`).emit('new_message', {
                message,
                conversationId: message.conversationId
            });
            // Queue async tasks
            await message_queue_1.MessageQueue.queueMessageSend({
                messageId: message.id,
                conversationId: message.conversationId,
                senderId: userId,
                recipientIds: message.recipients.map((r) => r.id)
            });
            // Callback success
            callback({ success: true, message });
        }
        catch (error) {
            console.error('Error sending message:', error);
            callback({ success: false, error: 'Failed to send message' });
        }
    }
    async handleTyping(socket, data) {
        const { conversationId, isTyping } = data;
        const userId = socket.data.user.id;
        socket.to(`conversation:${conversationId}`).emit('typing_indicator', {
            conversationId,
            userId,
            isTyping,
            timestamp: new Date()
        });
    }
    async handleReadMessages(socket, data) {
        try {
            const userId = socket.data.user.id;
            const { conversationId, messageIds } = data;
            await message_services_1.MessageService.markMessagesAsRead(messageIds, userId);
            // Emit read receipts
            this.io.to(`conversation:${conversationId}`).emit('messages_read', {
                conversationId,
                userId,
                messageIds,
                timestamp: new Date()
            });
            // Queue analytics
            await message_queue_1.MessageQueue.queueStatusUpdate({
                messageIds,
                status: 'READ',
                recipientId: userId
            });
        }
        catch (error) {
            console.error('Error reading messages:', error);
        }
    }
    async handleDeleteMessage(socket, data) {
        try {
            const userId = socket.data.user.id;
            const { messageId, deleteForEveryone } = data;
            const result = await message_services_1.MessageService.deleteMessage(messageId, userId, deleteForEveryone);
            if (result.deletedForEveryone) {
                this.io.to(`conversation:${result.conversationId}`).emit('message_deleted', {
                    messageId,
                    deletedBy: userId,
                    timestamp: new Date()
                });
            }
            else {
                socket.emit('message_deleted', {
                    messageId,
                    deletedBy: userId,
                    timestamp: new Date()
                });
            }
        }
        catch (error) {
            console.error('Error deleting message:', error);
            socket.emit('error', { error: 'Failed to delete message' });
        }
    }
    async handleReaction(socket, data) {
        try {
            const userId = socket.data.user.id;
            const { messageId, emoji } = data;
            const reaction = await message_services_1.MessageService.addReaction(messageId, userId, emoji);
            const message = await prisma_1.default.message.findUnique({
                where: { id: messageId },
                select: { conversationId: true }
            });
            if (message) {
                this.io.to(`conversation:${message.conversationId}`).emit('message_reaction', {
                    messageId,
                    reaction,
                    timestamp: new Date()
                });
            }
        }
        catch (error) {
            console.error('Error adding reaction:', error);
        }
    }
    async handleEditMessage(socket, data) {
        try {
            const userId = socket.data.user.id;
            const { messageId, newContent } = data;
            const message = await message_services_1.MessageService.editMessage(messageId, userId, newContent);
            this.io.to(`conversation:${message.conversationId}`).emit('message_edited', {
                messageId,
                newContent: message.content,
                editedAt: message.updatedAt,
                editedBy: userId
            });
        }
        catch (error) {
            console.error('Error editing message:', error);
            socket.emit('error', { error: 'Failed to edit message' });
        }
    }
    async handleStartCall(socket, data) {
        try {
            const userId = socket.data.user.id;
            const { conversationId, callType } = data;
            const call = await message_services_1.MessageService.startCall(conversationId, userId, callType);
            // Notify other participants
            call.participants
                .filter((p) => p.userId !== userId)
                .forEach((participant) => {
                const participantSocketId = this.connectedUsers.get(participant.userId);
                if (participantSocketId) {
                    this.io.to(participantSocketId).emit('incoming_call', {
                        callId: call.callId,
                        conversationId,
                        callerId: userId,
                        callerName: socket.data.user.fullName,
                        callType,
                        timestamp: new Date()
                    });
                }
            });
            socket.emit('call_started', {
                callId: call.callId,
                participants: call.participants
            });
        }
        catch (error) {
            console.error('Error starting call:', error);
            socket.emit('error', { error: 'Failed to start call' });
        }
    }
    async handleEndCall(socket, data) {
        try {
            const userId = socket.data.user.id;
            const { callId, reason } = data;
            const call = await message_services_1.MessageService.endCall(callId, userId, reason);
            // Notify all participants
            call.conversation.participants.forEach((participant) => {
                const participantSocketId = this.connectedUsers.get(participant.userId);
                if (participantSocketId) {
                    this.io.to(participantSocketId).emit('call_ended', {
                        callId,
                        endedBy: userId,
                        reason,
                        timestamp: new Date()
                    });
                }
            });
        }
        catch (error) {
            console.error('Error ending call:', error);
            socket.emit('error', { error: 'Failed to end call' });
        }
    }
    async handleCallAnswer(socket, data) {
        try {
            const userId = socket.data.user.id;
            const { callId, answer } = data;
            const result = await message_services_1.MessageService.answerCall(callId, userId, answer);
            if (result.accepted) {
                // Notify caller
                const callerSocketId = this.connectedUsers.get(result.call.initiatorId);
                if (callerSocketId) {
                    this.io.to(callerSocketId).emit('call_accepted', {
                        callId,
                        acceptedBy: userId,
                        timestamp: new Date()
                    });
                }
            }
            else {
                // Notify caller about decline
                const callerSocketId = this.connectedUsers.get(result.call.initiatorId);
                if (callerSocketId) {
                    this.io.to(callerSocketId).emit('call_declined', {
                        callId,
                        declinedBy: userId,
                        timestamp: new Date()
                    });
                }
            }
        }
        catch (error) {
            console.error('Error answering call:', error);
            socket.emit('error', { error: 'Failed to answer call' });
        }
    }
    async handleIceCandidate(socket, data) {
        const { callId, candidate, targetUserId } = data;
        const userId = socket.data.user.id;
        const targetSocketId = this.connectedUsers.get(targetUserId);
        if (targetSocketId) {
            this.io.to(targetSocketId).emit('ice_candidate', {
                callId,
                candidate,
                fromUserId: userId,
                timestamp: new Date()
            });
        }
    }
    async handleOffer(socket, data) {
        const { callId, offer, targetUserId } = data;
        const userId = socket.data.user.id;
        const targetSocketId = this.connectedUsers.get(targetUserId);
        if (targetSocketId) {
            this.io.to(targetSocketId).emit('offer', {
                callId,
                offer,
                fromUserId: userId,
                timestamp: new Date()
            });
        }
    }
    async handleAnswer(socket, data) {
        const { callId, answer, targetUserId } = data;
        const userId = socket.data.user.id;
        const targetSocketId = this.connectedUsers.get(targetUserId);
        if (targetSocketId) {
            this.io.to(targetSocketId).emit('answer', {
                callId,
                answer,
                fromUserId: userId,
                timestamp: new Date()
            });
        }
    }
    async handleUpdatePresence(socket, data) {
        const userId = socket.data.user.id;
        const { status, customStatus } = data;
        await redis_1.PresenceService.setOnline(userId);
        if (customStatus) {
            await prisma_1.default.user.update({
                where: { id: userId },
                data: { availability: customStatus }
            });
        }
        // Notify contacts
        await this.notifyContactsOfStatusChange(userId, status);
    }
    async getUserContacts(userId) {
        const conversations = await prisma_1.default.conversation.findMany({
            where: {
                participants: {
                    some: { userId }
                }
            },
            include: {
                participants: {
                    select: { userId: true }
                }
            }
        });
        const contactIds = new Set();
        conversations.forEach(conversation => {
            conversation.participants.forEach(participant => {
                if (participant.userId !== userId) {
                    contactIds.add(participant.userId);
                }
            });
        });
        return Array.from(contactIds);
    }
}
exports.SocketHandlers = SocketHandlers;
