"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestHealthStatusUpdate = exports.requestWeightUpdate = exports.toggleNotificationSetting = exports.updateNotificationSettings = exports.getNotificationSettings = exports.updateNotificationStatus = exports.getNotifications = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const BadRequestError_1 = require("../errors/BadRequestError");
const notification_helpers_1 = require("../helpers/notification.helpers");
const getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, status } = req.query;
        const where = { recipientId: userId };
        if (status)
            where.status = String(status);
        const [notifications, total, unreadCount] = await Promise.all([
            prisma_1.default.notification.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { sentAt: 'desc' },
                include: {
                    recipient: {
                        select: {
                            id: true,
                            fullName: true,
                            role: true
                        }
                    }
                }
            }),
            prisma_1.default.notification.count({ where }),
            prisma_1.default.notification.count({
                where: { ...where, status: 'UNREAD' }
            })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Notifications retrieved successfully', {
            notifications,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            },
            unreadCount
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotifications = getNotifications;
const updateNotificationStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.notificationId;
        const { status } = req.body;
        const notification = await prisma_1.default.notification.update({
            where: {
                id: notificationId,
                recipientId: userId // Ensure user can only update their own notifications
            },
            data: {
                status,
                ...(status === 'READ' && { readAt: new Date() })
            }
        });
        if (!notification) {
            throw new NotFoundError_1.NotFoundError('Notification not found');
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Notification status updated successfully', {
            notification
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateNotificationStatus = updateNotificationStatus;
const getNotificationSettings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        let settings = await prisma_1.default.notificationSettings.findUnique({
            where: { userId }
        });
        // If settings don't exist, create default ones
        if (!settings) {
            settings = await prisma_1.default.notificationSettings.create({
                data: {
                    userId,
                    followUpReminders: true,
                    upcomingAppointments: true,
                    messageNotifications: true
                }
            });
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Notification settings retrieved successfully', { settings });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotificationSettings = getNotificationSettings;
const updateNotificationSettings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { followUpReminders, upcomingAppointments, messageNotifications } = req.body;
        // Check if settings exist
        const existingSettings = await prisma_1.default.notificationSettings.findUnique({
            where: { userId }
        });
        let settings;
        if (existingSettings) {
            // Update existing settings
            settings = await prisma_1.default.notificationSettings.update({
                where: { userId },
                data: {
                    ...(followUpReminders !== undefined && { followUpReminders }),
                    ...(upcomingAppointments !== undefined && { upcomingAppointments }),
                    ...(messageNotifications !== undefined && { messageNotifications })
                }
            });
        }
        else {
            // Create new settings with provided values or defaults
            settings = await prisma_1.default.notificationSettings.create({
                data: {
                    userId,
                    followUpReminders: followUpReminders !== undefined ? followUpReminders : true,
                    upcomingAppointments: upcomingAppointments !== undefined ? upcomingAppointments : true,
                    messageNotifications: messageNotifications !== undefined ? messageNotifications : true
                }
            });
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Notification settings updated successfully', { settings });
    }
    catch (error) {
        next(error);
    }
};
exports.updateNotificationSettings = updateNotificationSettings;
const toggleNotificationSetting = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { settingType } = req.params;
        const { enabled } = req.body;
        const validSettings = ['followUpReminders', 'upcomingAppointments', 'messageNotifications'];
        if (!validSettings.includes(settingType)) {
            throw new BadRequestError_1.BadRequestError('Invalid setting type. Must be one of: followUpReminders, upcomingAppointments, messageNotifications');
        }
        // Check if settings exist
        let settings = await prisma_1.default.notificationSettings.findUnique({
            where: { userId }
        });
        if (!settings) {
            // Create default settings first
            settings = await prisma_1.default.notificationSettings.create({
                data: {
                    userId,
                    followUpReminders: true,
                    upcomingAppointments: true,
                    messageNotifications: true
                }
            });
        }
        // Update the specific setting
        const updateData = {};
        updateData[settingType] = enabled;
        settings = await prisma_1.default.notificationSettings.update({
            where: { userId },
            data: updateData
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `${settingType} ${enabled ? 'enabled' : 'disabled'} successfully`, {
            setting: settingType,
            enabled,
            settings
        });
    }
    catch (error) {
        next(error);
    }
};
exports.toggleNotificationSetting = toggleNotificationSetting;
// Simplified controller using the helper
const requestWeightUpdate = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { livestockId } = req.params;
        const { additionalNotes } = req.body;
        const result = await notification_helpers_1.LivestockNotificationHelpers.createLivestockUpdateRequest(livestockId, 'WEIGHT_UPDATE', {
            id: userId,
            fullName: req.user.fullName,
            role: userRole
        }, additionalNotes);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `Weight update request sent to ${result.notifications.length} farmkeeper(s)`, {
            livestock: result.livestock,
            company: result.company,
            notificationsSent: result.notifications.length,
            skippedCount: result.skippedCount
        }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.requestWeightUpdate = requestWeightUpdate;
const requestHealthStatusUpdate = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { livestockId } = req.params;
        const { additionalNotes } = req.body;
        const result = await notification_helpers_1.LivestockNotificationHelpers.createLivestockUpdateRequest(livestockId, 'HEALTH_STATUS_UPDATE', {
            id: userId,
            fullName: req.user.fullName,
            role: userRole
        }, additionalNotes);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `Health status update request sent to ${result.notifications.length} farmkeeper(s)`, 201);
    }
    catch (error) {
        if (error.message.includes('not found') || error.message.includes('No farmkeeper')) {
            return next(new NotFoundError_1.NotFoundError(error.message));
        }
        next(error);
    }
};
exports.requestHealthStatusUpdate = requestHealthStatusUpdate;
// export const requestCombinedUpdate = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = (req.user as any).id;
//     const userRole = (req.user as any).role;
//     const { livestockId } = req.params;
//     const { additionalNotes } = req.body;
//     const result = await LivestockNotificationHelpers.createLivestockUpdateRequest(
//       livestockId,
//       'COMBINED_UPDATE',
//       {
//         id: userId,
//         fullName: (req.user as any).fullName,
//         role: userRole
//       },
//       additionalNotes
//     );
//     sendSuccessResponse(
//       res,
//       `Weight and health status update request sent to ${result.notifications.length} farmkeeper(s)`,
//       201
//     );
//   } catch (error: any) {
//     if (error.message.includes('not found') || error.message.includes('No farmkeeper')) {
//       return next(new NotFoundError(error.message));
//     }
//     next(error);
//   }
// };
