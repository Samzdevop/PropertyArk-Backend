"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscribersQuerySchema = exports.unsubscribeByEmailSchema = exports.subscribeSchema = void 0;
const zod_1 = require("zod");
exports.subscribeSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required').max(100),
        email: zod_1.z.string().email('Invalid email format'),
    }),
});
exports.unsubscribeByEmailSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        reason: zod_1.z.string().max(500).optional(),
    }),
});
exports.getSubscribersQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        isSubscribed: zod_1.z.enum(['true', 'false']).optional(),
        search: zod_1.z.string().optional(),
        page: zod_1.z.string().optional().default('1').transform(v => parseInt(v)),
        limit: zod_1.z.string().optional().default('20').transform(v => parseInt(v)),
    }),
});
