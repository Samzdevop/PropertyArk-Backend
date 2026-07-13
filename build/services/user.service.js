"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const argon2_1 = require("argon2");
const BadRequestError_1 = require("../errors/BadRequestError");
const UnauthorizedError_1 = require("../errors/UnauthorizedError");
const logger_1 = __importDefault(require("../config/logger"));
class UserService {
    static async changePassword(userId, currentPassword, newPassword) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                password: true,
                email: true,
                fullName: true,
            },
        });
        if (!user) {
            throw new BadRequestError_1.BadRequestError("User not found");
        }
        if (!user.password) {
            throw new BadRequestError_1.BadRequestError("This account uses Google login. Please use Google to sign in or set a password first.");
        }
        const isPasswordValid = await (0, argon2_1.verify)(user.password, currentPassword);
        if (!isPasswordValid) {
            throw new UnauthorizedError_1.UnauthorizedError("Current password is incorrect");
        }
        const hashedNewPassword = await (0, argon2_1.hash)(newPassword);
        await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                password: hashedNewPassword,
            },
        });
        logger_1.default.info(`Password changed successfully for user: ${user.email}`);
    }
}
exports.UserService = UserService;
