"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorActivitySummarySchema = exports.cleanupActivitiesSchema = exports.activityStatsSchema = exports.getEntityActivitiesSchema = exports.getUserActivitiesSchema = exports.getActivityByIdSchema = exports.getAllActivitiesSchema = void 0;
const zod_1 = require("zod");
exports.getAllActivitiesSchema = zod_1.z.object({
    query: zod_1.z.object({
        entityType: zod_1.z.string().optional(),
        action: zod_1.z.string().optional(),
        userId: zod_1.z.string().cuid().optional(),
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
        page: zod_1.z.string().optional().default('1').transform(val => parseInt(val)),
        limit: zod_1.z.string().optional().default('20').transform(val => parseInt(val))
    })
});
exports.getActivityByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().cuid('Invalid activity ID format')
    })
});
exports.getUserActivitiesSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string().cuid('Invalid user ID format')
    }),
    query: zod_1.z.object({
        entityType: zod_1.z.string().optional(),
        action: zod_1.z.string().optional(),
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
        page: zod_1.z.string().optional().default('1').transform(val => parseInt(val)),
        limit: zod_1.z.string().optional().default('20').transform(val => parseInt(val))
    })
});
exports.getEntityActivitiesSchema = zod_1.z.object({
    params: zod_1.z.object({
        entityType: zod_1.z.enum([
            'PROPERTY', 'USER', 'DOCUMENT',
            'NIN', 'PROPERTY_REVIEW', 'PAYMENT', 'NOTIFICATION'
        ]),
        entityId: zod_1.z.string().cuid('Invalid entity ID format')
    }),
    query: zod_1.z.object({
        page: zod_1.z.string().optional().default('1').transform(val => parseInt(val)),
        limit: zod_1.z.string().optional().default('20').transform(val => parseInt(val))
    })
});
exports.activityStatsSchema = zod_1.z.object({
    query: zod_1.z.object({
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional()
    }).optional()
});
exports.cleanupActivitiesSchema = zod_1.z.object({
    query: zod_1.z.object({
        days: zod_1.z.string().optional().default('90').transform(val => parseInt(val))
    })
});
exports.vendorActivitySummarySchema = zod_1.z.object({
    params: zod_1.z.object({
        vendorId: zod_1.z.string().cuid('Invalid vendor ID format')
    })
});
