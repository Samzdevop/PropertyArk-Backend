"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationStatus = exports.getNotifications = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
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
