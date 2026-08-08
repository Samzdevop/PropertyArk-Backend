"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBulkDetailsSchema = exports.getNotificationsSchema = exports.deleteNotificationSchema = exports.markAsReadSchema = exports.sendBulkSchema = exports.sendToUserSchema = void 0;
const zod_1 = require("zod");
exports.sendToUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().cuid("Invalid user ID"),
        title: zod_1.z.string().min(1, "Title is required").max(100, "Title too long"),
        message: zod_1.z.string().min(1, "Message is required").max(1000, "Message too long"),
        type: zod_1.z.enum(['RENT_DUE', 'LEASE_EXPIRING', 'MAINTENANCE_UPDATE', 'PAYMENT_CONFIRMATION', 'REQUEST_STATUS', 'GENERAL']).optional(),
        channel: zod_1.z.enum(['IN_APP', 'EMAIL', 'BOTH']).optional().default('IN_APP'),
        priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
        data: zod_1.z.any().optional()
    })
});
exports.sendBulkSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, "Title is required").max(100, "Title too long"),
        message: zod_1.z.string().min(1, "Message is required").max(1000, "Message too long"),
        type: zod_1.z.enum(['RENT_DUE', 'LEASE_EXPIRING', 'MAINTENANCE_UPDATE', 'PAYMENT_CONFIRMATION', 'REQUEST_STATUS', 'GENERAL']).optional(),
        channel: zod_1.z.enum(['IN_APP', 'EMAIL', 'BOTH']).optional().default('IN_APP'),
        priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
        target: zod_1.z.enum(['ALL', 'VENDOR', 'USER', 'STAFF', 'SPECIFIC']),
        userIds: zod_1.z.array(zod_1.z.string().cuid()).optional(),
        roles: zod_1.z.array(zod_1.z.enum(['VENDOR', 'USER', 'STAFF'])).optional(),
        data: zod_1.z.any().optional()
    }).refine((data) => {
        if (data.target === 'SPECIFIC' && (!data.userIds || data.userIds.length === 0)) {
            return false;
        }
        return true;
    }, {
        message: "User IDs are required when target is SPECIFIC",
        path: ["userIds"]
    })
});
exports.markAsReadSchema = zod_1.z.object({
    params: zod_1.z.object({
        notificationId: zod_1.z.string().cuid("Invalid notification ID")
    })
});
exports.deleteNotificationSchema = zod_1.z.object({
    params: zod_1.z.object({
        notificationId: zod_1.z.string().cuid("Invalid notification ID")
    })
});
exports.getNotificationsSchema = zod_1.z.object({
    query: zod_1.z.object({
        read: zod_1.z.enum(['true', 'false']).optional(),
        type: zod_1.z.enum(['RENT_DUE', 'LEASE_EXPIRING', 'MAINTENANCE_UPDATE', 'PAYMENT_CONFIRMATION', 'REQUEST_STATUS', 'GENERAL']).optional(),
        channel: zod_1.z.enum(['IN_APP', 'EMAIL', 'BOTH']).optional(),
        priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
        page: zod_1.z.string().optional().default('1').transform(val => parseInt(val)),
        limit: zod_1.z.string().optional().default('20').transform(val => parseInt(val))
    })
});
exports.getBulkDetailsSchema = zod_1.z.object({
    params: zod_1.z.object({
        bulkId: zod_1.z.string().min(1, "Bulk ID is required")
    })
});
