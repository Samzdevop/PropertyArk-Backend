"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableSlotsSchema = exports.getAvailabilitySchema = exports.addAvailabilitySchema = exports.setAvailabilitySchema = void 0;
const zod_1 = require("zod");
exports.setAvailabilitySchema = zod_1.z.object({
    body: zod_1.z.object({
        slots: zod_1.z.array(zod_1.z.object({
            date: zod_1.z.string().datetime({ message: "Invalid date format. Use ISO format." }),
            startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm"),
            endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm"),
            isRecurring: zod_1.z.boolean().optional(),
            dayOfWeek: zod_1.z.number().min(0).max(6).optional()
        }))
    })
});
exports.addAvailabilitySchema = zod_1.z.object({
    body: zod_1.z.object({
        date: zod_1.z.string().datetime({ message: "Invalid date format. Use ISO format." }),
        startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm"),
        endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm"),
        isRecurring: zod_1.z.boolean().optional(),
        dayOfWeek: zod_1.z.number().min(0).max(6).optional()
    })
});
exports.getAvailabilitySchema = zod_1.z.object({
    query: zod_1.z.object({
        startDate: zod_1.z.string().optional().refine((val) => {
            if (!val)
                return true;
            const date = new Date(val);
            return !isNaN(date.getTime());
        }, { message: "Invalid date format. Use YYYY-MM-DD or ISO datetime" }),
        endDate: zod_1.z.string().optional().refine((val) => {
            if (!val)
                return true;
            const date = new Date(val);
            return !isNaN(date.getTime());
        }, { message: "Invalid date format. Use YYYY-MM-DD or ISO datetime" })
    })
});
exports.getAvailableSlotsSchema = zod_1.z.object({
    params: zod_1.z.object({
        vendorId: zod_1.z.string().cuid()
    }),
    query: zod_1.z.object({
        date: zod_1.z.string().refine((val) => {
            const date = new Date(val);
            return !isNaN(date.getTime());
        }, { message: "Invalid date format. Use YYYY-MM-DD or ISO datetime" })
    })
});
