"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.httpServer = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = __importDefault(require("./config/logger"));
const auth_routes_1 = require("./routes/auth.routes");
const notFoundRoute_1 = require("./middlewares/notFoundRoute");
const errorHandler_1 = require("./middlewares/errorHandler");
const users_routes_1 = require("./routes/users.routes");
const passport_1 = __importDefault(require("passport"));
require("./config/passport");
const livestock_routes_1 = require("./routes/livestock.routes");
const vaccination_routes_1 = require("./routes/vaccination.routes");
const sickness_routes_1 = require("./routes/sickness.routes");
const treatment_routes_1 = require("./routes/treatment.routes");
const offtake_routes_1 = require("./routes/offtake.routes");
const task_routes_1 = require("./routes/task.routes");
const inventory_routes_1 = require("./routes/inventory.routes");
const finance_routes_1 = require("./routes/finance.routes");
const diagnosis_routes_1 = require("./routes/diagnosis.routes");
const notification_routes_1 = require("./routes/notification.routes");
const appointment_routes_1 = require("./routes/appointment.routes");
const note_routes_1 = require("./routes/note.routes");
const upload_1 = require("./config/upload");
const chat_routes_1 = require("./routes/chat.routes");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const socketAuth_1 = require("./middlewares/socketAuth");
exports.app = (0, express_1.default)();
exports.httpServer = (0, http_1.createServer)(exports.app);
exports.io = new socket_io_1.Server(exports.httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL === "production" ? false : ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Authorization', 'Content-Type']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});
// io.use(SocketAuth.authenticate);
exports.io.use((socket, next) => {
    console.log(`🔑 Socket auth attempt - Headers:`, socket.handshake.headers);
    console.log(`🔑 Socket auth token:`, socket.handshake.auth?.token);
    // Call your auth middleware but catch errors
    socketAuth_1.SocketAuth.authenticate(socket, (error) => {
        if (error) {
            console.error(`❌ Socket auth failed:`, error.message);
            console.error(`❌ Full error:`, error);
        }
        else {
            console.log(`✅ Socket auth successful for user:`, socket.data.user?.id);
        }
        next(error);
    });
});
exports.io.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    const userName = socket.data.user?.fullName;
    console.log(`
  ============================================
  🔌 NEW SOCKET CONNECTION
  ============================================
  👤 User ID:    ${userId}
  👤 User Name:  ${userName || 'Unknown'}
  🆔 Socket ID:  ${socket.id}
  🌐 IP Address: ${socket.handshake.address}
  📅 Connected:  ${new Date().toLocaleTimeString()}
  ============================================
  `);
    logger_1.default.info(`Socket connected - User: ${userId}, Socket: ${socket.id}`);
    socket.join(`user:${userId}`);
    console.log(`📌 User ${userId} joined room: user:${userId}`);
    socket.on('ping', (callback) => {
        console.log(`🏓 Ping from ${userId} (${socket.id})`);
        if (callback)
            callback('pong');
    });
    socket.on('echo', (data, callback) => {
        console.log(`🔁 Echo from ${userId}: "${data}"`);
        if (callback)
            callback({
                echo: data,
                timestamp: new Date().toISOString(),
                socketId: socket.id
            });
    });
    socket.on('disconnect', () => {
        console.log(`
    ============================================
    🔌 SOCKET DISCONNECTED
    ============================================
    👤 User ID:    ${userId}
    🆔 Socket ID:  ${socket.id}
    📅 Disconnected: ${new Date().toLocaleTimeString()}
    ============================================
    `);
        logger_1.default.info(`Socket disconnected - User: ${userId}, Socket: ${socket.id}`);
    });
    socket.on('error', (error) => {
        console.error(`❌ Socket error for user ${userId}:`, error);
        logger_1.default.error(`Socket error for user ${userId}:`, error);
    });
});
exports.app.use(passport_1.default.initialize());
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
exports.app.use(express_1.default.json());
(0, morgan_1.default)('tiny');
const stream = {
    write: (text) => {
        logger_1.default.info(text);
    },
};
exports.app.use((0, morgan_1.default)(':method :url :status :response-time ms - :res[content-length]', {
    stream,
}));
exports.app.get('/', (_req, res) => {
    res.json({ success: true, message: 'Agritech API is working just fine!' });
});
exports.app.get('/socket-status', (_req, res) => {
    res.json({
        success: true,
        socket: {
            connected: exports.io.engine.clientsCount,
            server: 'Socket.IO running',
            port: process.env.PORT || 5000,
            endpoint: `ws://localhost:${process.env.PORT || 5000}`
        }
    });
});
exports.app.use("/uploads", express_1.default.static(upload_1.UPLOADS_PATH));
exports.app.use('/api/v1/auth', auth_routes_1.authRouter);
exports.app.use('/api/v1/users', users_routes_1.usersRouter);
exports.app.use('/api/v1/livestock', livestock_routes_1.livestockRouter);
exports.app.use('/api/v1/', vaccination_routes_1.vaccinationRouter);
exports.app.use('/api/v1/sickness', sickness_routes_1.sicknessRouter);
exports.app.use('/api/v1/treatment', treatment_routes_1.treatmentRouter);
exports.app.use('/api/v1/offtake', offtake_routes_1.offtakeRouter);
exports.app.use('/api/v1/tasks', task_routes_1.taskRouter);
exports.app.use('/api/v1/inventory', inventory_routes_1.inventoryRouter);
exports.app.use('/api/v1/finance', finance_routes_1.financeRouter);
exports.app.use('/api/v1/diagnosis', diagnosis_routes_1.diagnosisRouter);
exports.app.use('/api/v1/notifications', notification_routes_1.notificationRouter);
exports.app.use('/api/v1/appointments', appointment_routes_1.appointmentRouter);
exports.app.use('/api/v1/notes', note_routes_1.noteRouter);
exports.app.use('/api/v1/chat', chat_routes_1.chatRouter);
exports.app.use(notFoundRoute_1.notFoundHandler);
exports.app.use(errorHandler_1.errorHandler);
