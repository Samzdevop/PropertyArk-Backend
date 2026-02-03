"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../prisma"));
class SocketAuth {
    static async authenticate(socket, next) {
        try {
            console.log(`🔐 [SocketAuth] Starting authentication...`);
            const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const user = await prisma_1.default.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    fullName: true,
                    role: true,
                    isVerified: true,
                    isSuspended: true,
                    companyId: true,
                    avatar: true
                }
            });
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }
            if (user.isSuspended) {
                return next(new Error('Authentication error: Account suspended'));
            }
            socket.data.user = user;
            next();
        }
        catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error('Authentication error: Invalid token'));
        }
    }
}
exports.SocketAuth = SocketAuth;
