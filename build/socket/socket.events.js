"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketEvents = void 0;
class SocketEvents {
    io;
    handlers;
    connectedUsers;
    constructor(io, handlers, connectedUsers) {
        this.io = io;
        this.handlers = handlers;
        this.connectedUsers = connectedUsers;
    }
    setupSocketEvents(socket) {
        const userId = socket.data.user.id;
        // Update user presence
        this.handlers.updateUserPresence(userId, true);
        this.handlers.notifyContactsOfStatusChange(userId, 'online');
        // Join user to personal room
        socket.join(`user:${userId}`);
        // Join conversation rooms
        this.handlers.joinUserToConversationRooms(socket, userId);
        // Message events
        socket.on('send_message', (data, callback) => {
            this.handlers.handleSendMessage(socket, data, callback);
        });
        socket.on('typing', (data) => {
            this.handlers.handleTyping(socket, data);
        });
        socket.on('read_messages', (data) => {
            this.handlers.handleReadMessages(socket, data);
        });
        socket.on('delete_message', (data) => {
            this.handlers.handleDeleteMessage(socket, data);
        });
        socket.on('react_to_message', (data) => {
            this.handlers.handleReaction(socket, data);
        });
        socket.on('edit_message', (data) => {
            this.handlers.handleEditMessage(socket, data);
        });
        // Call events
        socket.on('start_call', (data) => {
            this.handlers.handleStartCall(socket, data);
        });
        socket.on('end_call', (data) => {
            this.handlers.handleEndCall(socket, data);
        });
        socket.on('call_answer', (data) => {
            this.handlers.handleCallAnswer(socket, data);
        });
        socket.on('ice_candidate', (data) => {
            this.handlers.handleIceCandidate(socket, data);
        });
        socket.on('offer', (data) => {
            this.handlers.handleOffer(socket, data);
        });
        socket.on('answer', (data) => {
            this.handlers.handleAnswer(socket, data);
        });
        // Presence events
        socket.on('update_presence', (data) => {
            this.handlers.handleUpdatePresence(socket, data);
        });
        // Error handling
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }
}
exports.SocketEvents = SocketEvents;
