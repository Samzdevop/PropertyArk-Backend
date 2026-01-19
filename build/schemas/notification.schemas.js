"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestUpdateSchema = exports.updateNotificationSettingsSchema = void 0;
const zod_1 = require("zod");
exports.updateNotificationSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        followUpReminders: zod_1.z.boolean().optional(),
        upcomingAppointments: zod_1.z.boolean().optional(),
        messageNotifications: zod_1.z.boolean().optional()
    })
});
exports.requestUpdateSchema = zod_1.z.object({
    body: zod_1.z.object({
        additionalNotes: zod_1.z.string().optional()
    })
});
