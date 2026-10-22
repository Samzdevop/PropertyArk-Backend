"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchRole = exports.completeInquiry = exports.getUserInquiriesStats = exports.getUserDashboard = exports.changePassword = exports.removeAvatar = exports.updateAvatar = exports.selfDeleteAccount = exports.deleteUser = exports.getAllUsers = exports.adminUpdateUser = exports.updateProfile = exports.getProfile = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const BadRequestError_1 = require("../errors/BadRequestError");
const upload_1 = require("../config/upload");
const activity_controller_1 = require("./activity.controller");
const selects_1 = require("../prisma/selects");
const client_1 = require("@prisma/client");
const user_service_1 = require("../services/user.service");
const attachBaseUrl_utils_1 = require("../utils/attachBaseUrl.utils");
const serialize_utils_1 = require("../utils/serialize.utils");
const logger_1 = __importDefault(require("../config/logger"));
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
const adminUpdateUser = async (req, res, next) => {
    try {
        const adminUser = req.user;
        const { userId } = req.params;
        const { fullName, phone, location, role, isSuspended, isVerified } = req.body;
        const targetUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!targetUser) {
            throw new NotFoundError_1.NotFoundError('User not found');
        }
        if (userId === adminUser.id && role && role !== 'ADMIN') {
            throw new BadRequestError_1.BadRequestError('You cannot change your own role');
        }
        if (targetUser.role === 'ADMIN' && adminUser.id !== userId) {
            throw new ForbiddenError_1.ForbiddenError('Cannot modify other admin accounts');
        }
        // Build update data
        const updateData = {};
        if (fullName !== undefined)
            updateData.fullName = fullName;
        if (phone !== undefined)
            updateData.phone = phone;
        if (location !== undefined)
            updateData.location = location;
        if (role !== undefined)
            updateData.role = role;
        if (isSuspended !== undefined)
            updateData.isSuspended = isSuspended;
        if (isVerified !== undefined)
            updateData.isVerified = isVerified;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: updateData,
            select: selects_1.userSelect,
        });
        await (0, activity_controller_1.logActivity)(adminUser.id, 'ADMIN_UPDATE_USER', 'USER', userId, {
            targetUserEmail: targetUser.email,
            updates: Object.keys(updateData),
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'User updated successfully', {
            user: updatedUser,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.adminUpdateUser = adminUpdateUser;
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
const selfDeleteAccount = async (req, res, next) => {
    try {
        const user = req.user;
        const { password, reason, confirmationPhrase } = req.body;
        const result = await user_service_1.UserService.selfDeleteAccount(user.id, {
            password,
            reason,
            confirmationPhrase,
        });
        await (0, activity_controller_1.logActivity)(user.id, 'SELF_DELETE_ACCOUNT', 'USER', user.id, {
            originalEmail: result.originalEmail,
            reason: reason || 'User requested account deletion',
            creditPointsLost: result.creditPointsLost,
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Your account has been deleted successfully. We're sorry to see you go.", {
            deletedAt: result.user.deletedAt,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.selfDeleteAccount = selfDeleteAccount;
// export const getDeletionInfo = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = req.user as any;
//     const info = await UserService.getDeletionInfo(user.id);
//     sendSuccessResponse(
//       res,
//       "Deletion info retrieved successfully",
//       info
//     );
//   } catch (error) {
//     next(error);
//   }
const updateAvatar = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const file = req.file;
        if (!file) {
            throw new BadRequestError_1.BadRequestError("No file uploaded");
        }
        // console.log('Avatar upload details:', {
        //   originalname: file.originalname,
        //   mimetype: file.mimetype,
        //   size: file.size,
        //   key: (file as any).key,
        //   location: (file as any).location,
        // });
        const currentUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { avatar: true }
        });
        if (!currentUser) {
            throw new BadRequestError_1.BadRequestError("User not found");
        }
        const driver = process.env.STORAGE_DRIVER || 'local';
        const container = upload_1.STORAGE_CONTAINERS.USER_AVATARS;
        let avatarUrl;
        if (driver === 'azure') {
            avatarUrl = await (0, upload_1.uploadToAzure)(file, container);
        }
        else if (driver === 's3') {
            const s3File = file;
            avatarUrl = s3File.location || `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3File.key}`;
        }
        else {
            avatarUrl = `/uploads/${file.filename}`;
        }
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
        const oldAvatarUrl = currentUser.avatar;
        if (oldAvatarUrl &&
            !oldAvatarUrl.includes('randomuser.me') &&
            !oldAvatarUrl.includes('ui-avatars')) {
            try {
                if (driver === 's3') {
                    const parsedUrl = new URL(oldAvatarUrl);
                    const oldKey = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
                    if (oldKey.startsWith(`${upload_1.STORAGE_CONTAINERS.USER_AVATARS}/`)) {
                        await (0, upload_1.deleteFile)(oldKey, container);
                        console.log('Previous avatar deleted from S3:', oldKey);
                    }
                    else {
                        console.warn('Skipping deletion: avatar is outside user-avatars/', oldKey);
                    }
                }
                else {
                    const oldKey = oldAvatarUrl.split('/').pop();
                    if (oldKey) {
                        await (0, upload_1.deleteFile)(oldKey, container);
                    }
                }
            }
            catch (err) {
                console.error('Failed to delete previous avatar:', err);
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
const getUserDashboard = async (req, res, next) => {
    try {
        const user = req.user;
        const dashboardData = await user_service_1.UserService.getUserDashboardStats(user.id);
        const dataWithUrls = (0, attachBaseUrl_utils_1.attachBaseUrlUploads)((0, serialize_utils_1.serializeDates)(dashboardData), req);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_USER_DASHBOARD', 'DASHBOARD', 'user', {
            savedProperties: dashboardData.userStats.savedProperties,
            activeInquiries: dashboardData.userStats.activeInquiries
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "User dashboard retrieved successfully", dataWithUrls);
    }
    catch (error) {
        next(error);
    }
};
exports.getUserDashboard = getUserDashboard;
const getUserInquiriesStats = async (req, res, next) => {
    try {
        const user = req.user;
        const stats = await user_service_1.UserService.getUserInquiriesStats(user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_USER_INQUIRIES_STATS', 'INQUIRY', 'stats', {
            total: stats.stats.total,
            pending: stats.stats.pending,
            completed: stats.stats.completed
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "User inquiries statistics retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getUserInquiriesStats = getUserInquiriesStats;
const completeInquiry = async (req, res, next) => {
    try {
        const user = req.user;
        const { inquiryId } = req.params;
        const { satisfactionStatus, satisfactionComment } = req.body;
        const inquiry = await user_service_1.UserService.completeInquiry(inquiryId, user.id, { satisfactionStatus, satisfactionComment });
        await (0, activity_controller_1.logActivity)(user.id, 'COMPLETE_INQUIRY', 'INQUIRY', inquiryId, {
            inquiryNumber: inquiry.inquiryNumber,
            satisfactionStatus: inquiry.satisfactionStatus,
            propertyName: inquiry.property.name,
            status: inquiry.status
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Inquiry marked as completed successfully", inquiry);
    }
    catch (error) {
        next(error);
    }
};
exports.completeInquiry = completeInquiry;
const switchRole = async (req, res, next) => {
    try {
        const user = req.user;
        const { role } = req.body;
        const dbUser = await user_service_1.UserService.validateRoleSwitch(user.id, role);
        const updatedUser = await prisma_1.default.user.update({
            where: { id: user.id },
            data: { role: role === 'VENDOR' ? client_1.Role.VENDOR : client_1.Role.USER },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                ninVerificationStatus: true,
                creditPoints: true,
            },
        });
        let welcomeBonus = null;
        if (dbUser.role === client_1.Role.USER && role === 'VENDOR') {
            const alreadyGotBonus = await prisma_1.default.creditTransaction.findFirst({
                where: {
                    userId: user.id,
                    type: client_1.CreditTransactionType.ADMIN_ADJUSTMENT,
                    OR: [
                        { description: { startsWith: 'Welcome bonus for new vendor' } },
                        {
                            metadata: {
                                path: ['isWelcomeBonus'],
                                equals: true,
                            },
                        },
                    ],
                },
            });
            if (!alreadyGotBonus) {
                const settings = await prisma_1.default.creditPointSettings.findFirst({
                    where: { isActive: true },
                });
                const bonusPoints = settings?.newVendorBonusPoints ?? 0;
                if (bonusPoints > 0) {
                    const expiresAt = settings?.newVendorBonusExpiryDays
                        ? new Date(Date.now() +
                            settings.newVendorBonusExpiryDays * 24 * 60 * 60 * 1000)
                        : null;
                    const grantId = `WLCM-${Date.now()}-${Math.random()
                        .toString(36)
                        .substring(2, 8)
                        .toUpperCase()}`;
                    const result = await prisma_1.default.$transaction(async (tx) => {
                        const balanceBefore = updatedUser.creditPoints;
                        const balanceAfter = balanceBefore + bonusPoints;
                        await tx.user.update({
                            where: { id: user.id },
                            data: {
                                creditPoints: balanceAfter,
                                creditPointsPurchased: { increment: bonusPoints },
                            },
                        });
                        const transaction = await tx.creditTransaction.create({
                            data: {
                                transactionNumber: `CRT-${Date.now()}-${Math.random()
                                    .toString(36)
                                    .substring(2, 8)}`,
                                userId: user.id,
                                type: client_1.CreditTransactionType.ADMIN_ADJUSTMENT,
                                status: client_1.CreditTransactionStatus.COMPLETED,
                                points: bonusPoints,
                                balanceBefore,
                                balanceAfter,
                                description: `Welcome bonus for new vendor (${bonusPoints} points)`,
                                metadata: {
                                    isWelcomeBonus: true,
                                    grantId,
                                    grantedBy: 'system',
                                    trigger: 'first_vendor_switch',
                                },
                                expiresAt,
                            },
                        });
                        return { transaction, balanceAfter };
                    });
                    welcomeBonus = {
                        points: bonusPoints,
                        grantId,
                    };
                    // Reflect the new balance in the response snapshot
                    updatedUser.creditPoints = result.balanceAfter;
                    logger_1.default.info(`Welcome bonus awarded to ${dbUser.email} on first vendor switch: ${bonusPoints} points`);
                }
            }
        }
        // 4. In-app notification
        await prisma_1.default.notification.create({
            data: {
                userId: user.id,
                type: 'GENERAL',
                title: 'Account Role Updated',
                message: `Your account role was changed from ${dbUser.role} to ${role}.${welcomeBonus
                    ? ` A welcome bonus of ${welcomeBonus.points} credit points has been added.`
                    : ''} All your data has been preserved.`,
                data: {
                    previousRole: dbUser.role,
                    newRole: role,
                    ...(welcomeBonus && { welcomeBonus }),
                },
            },
        });
        // 5. Activity log
        await (0, activity_controller_1.logActivity)(user.id, 'SWITCH_ROLE', 'USER', user.id, {
            previousRole: dbUser.role,
            newRole: role,
            ...(welcomeBonus && { welcomeBonus }),
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `Role switched to ${role.toLowerCase()} successfully`, {
            user: updatedUser,
            ...(welcomeBonus && { welcomeBonus }),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.switchRole = switchRole;
