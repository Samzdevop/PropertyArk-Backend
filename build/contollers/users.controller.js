"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.removeAvatar = exports.updateAvatar = exports.deleteUser = exports.getAllUsers = exports.updateProfile = exports.getProfile = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const BadRequestError_1 = require("../errors/BadRequestError");
const upload_1 = require("../config/upload");
const activity_controller_1 = require("./activity.controller");
const selects_1 = require("../prisma/selects");
const user_service_1 = require("../services/user.service");
const getProfile = async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: selects_1.userSelect
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Profile successfully retrieved', user);
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fullName, phone, location, avatar } = req.body;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId }
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                fullName,
                phone,
                location,
                avatar
            },
            select: selects_1.userSelect
        });
        await prisma_1.default.activityLog.create({
            data: {
                userId,
                action: 'UPDATE_PROFILE',
                entityType: 'USER',
                entityId: userId,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Profile successfully updated', { updatedUser });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
const getAllUsers = async (req, res, next) => {
    try {
        const requestingUser = req.user;
        const { page = 1, limit = 10, role } = req.query;
        let allowedRoles = [];
        // if(requestingUser.role === 'ADMIN'){
        // 	allowedRoles = ['VENDOR', 'USER', 'STAFF'];
        // }else {
        // 	throw new ForbiddenError('You don not have permission to view users');
        // }
        if (requestingUser.role === 'ADMIN') {
            if (role) {
                const validRoles = ['VENDOR', 'USER', 'STAFF'];
                if (!validRoles.includes(role)) {
                    throw new BadRequestError_1.BadRequestError(`Invalid role. Allowed: ${validRoles.join(', ')}`);
                }
                allowedRoles = [role];
            }
            else {
                allowedRoles = ['VENDOR', 'USER', 'STAFF'];
            }
        }
        else {
            throw new ForbiddenError_1.ForbiddenError('You do not have permission to view users');
        }
        const where = {
            role: { in: allowedRoles },
            id: { not: requestingUser.id }
        };
        const [users, total] = await Promise.all([
            prisma_1.default.user.findMany({
                where: {
                    role: { in: allowedRoles },
                    id: { not: requestingUser.id }
                },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                select: selects_1.userSelect,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.user.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Users retrieved successfully', {
            users,
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
exports.getAllUsers = getAllUsers;
// export const deleteUser = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = req.params.userId;
//     const user = await prisma.user.findUnique({
//       where: { id: userId as string },
//     });
//     if (!user) throw new NotFoundError("User not found");
//     await prisma.$transaction(async (tx) => {
//       await tx.document.deleteMany({
//         where: {
//           uploadedById: userId as string,
//         },
//       });
//       await tx.user.delete({
//         where: {
//           id: userId as string,
//         },
//       });
//     });
//     res.status(204).end();
//   } catch (error) {
//     next(error);
//   }
// };
const deleteUser = async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.params.userId }
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        await prisma_1.default.user.delete({
            where: { id: req.params.userId }
        });
        // console.log({ user });
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
const updateAvatar = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const file = req.file;
        if (!file) {
            throw new BadRequestError_1.BadRequestError("No file uploaded");
        }
        const currentUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { avatar: true }
        });
        const container = upload_1.STORAGE_CONTAINERS.USER_AVATARS;
        const avatarUrl = process.env.STORAGE_DRIVER === 'azure'
            ? await (0, upload_1.uploadToAzure)(file, container)
            : `/uploads/${file.filename}`;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { avatar: avatarUrl },
            select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true
            }
        });
        if (currentUser?.avatar && !currentUser.avatar.includes('randomuser.me') && !currentUser.avatar.includes('ui-avatars')) {
            const oldKey = currentUser.avatar.split('/').pop();
            if (oldKey) {
                await (0, upload_1.deleteFile)(oldKey, container).catch(err => console.error('Failed to delete old avatar:', err));
            }
        }
        await (0, activity_controller_1.logActivity)(userId, 'UPDATE_AVATAR', 'USER', userId, { avatarUrl }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Avatar updated successfully", updatedUser);
    }
    catch (error) {
        next(error);
    }
};
exports.updateAvatar = updateAvatar;
const removeAvatar = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const currentUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { avatar: true }
        });
        if (currentUser?.avatar && !currentUser.avatar.includes('randomuser.me') && !currentUser.avatar.includes('ui-avatars')) {
            const container = upload_1.STORAGE_CONTAINERS.USER_AVATARS;
            const oldKey = currentUser.avatar.split('/').pop();
            if (oldKey) {
                await (0, upload_1.deleteFile)(oldKey, container).catch(err => console.error('Failed to delete avatar:', err));
            }
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { avatar: null },
            select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true
            }
        });
        await (0, activity_controller_1.logActivity)(userId, 'REMOVE_AVATAR', 'USER', userId, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Avatar removed successfully", updatedUser);
    }
    catch (error) {
        next(error);
    }
};
exports.removeAvatar = removeAvatar;
const changePassword = async (req, res, next) => {
    try {
        const user = req.user;
        const { currentPassword, newPassword } = req.body;
        await user_service_1.UserService.changePassword(user.id, currentPassword, newPassword);
        await (0, activity_controller_1.logActivity)(user.id, "CHANGE_PASSWORD", "USER", user.id, {
            action: "Password changed successfully",
            timestamp: new Date().toISOString(),
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Password changed successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.changePassword = changePassword;
