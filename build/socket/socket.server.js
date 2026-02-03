"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketServer = void 0;
const socket_io_1 = require("socket.io");
const redis_1 = require("../config/redis");
const socketAuth_1 = require("../middlewares/socketAuth");
const socket_handlers_1 = require("../socket/socket.handlers");
const socket_events_1 = require("../socket/socket.events");
const redis_adapter_1 = require("@socket.io/redis-adapter");
class SocketServer {
    io;
    handlers;
    events;
    connectedUsers = new Map();
    constructor(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
                credentials: true
            },
            // adapter: createRedisAdapter(),
            transports: ['websocket', 'polling']
        });
        this.io.adapter((0, redis_adapter_1.createAdapter)(redis_1.redisClient, redis_1.redisSubscriber));
        this.handlers = new socket_handlers_1.SocketHandlers(this.io, this.connectedUsers);
        this.events = new socket_events_1.SocketEvents(this.io, this.handlers, this.connectedUsers);
        this.setupMiddleware();
        this.setupConnection();
        this.getIO = () => this.io;
    }
    setupMiddleware() {
        // Socket authentication
        this.io.use(socketAuth_1.SocketAuth.authenticate);
    }
    setupConnection() {
        this.io.on('connection', (socket) => {
            const userId = socket.data.user.id;
            this.connectedUsers.set(userId, socket.id);
            console.log(`Socket connected: ${userId} (${socket.id})`);
            this.events.setupSocketEvents(socket);
            socket.on('disconnect', () => {
                this.connectedUsers.delete(userId);
                console.log(`Socket disconnected: ${userId}`);
                this.handlers.updateUserPresence(userId, false);
                this.handlers.notifyContactsOfStatusChange(userId, 'offline');
            });
        });
    }
    getIO() {
        return this.io;
    }
    getConnectedUsers() {
        return new Map(this.connectedUsers);
    }
    isUserConnected(userId) {
        return this.connectedUsers.has(userId);
    }
    getSocketId(userId) {
        return this.connectedUsers.get(userId);
    }
}
exports.SocketServer = SocketServer;
exports.default = SocketServer;
