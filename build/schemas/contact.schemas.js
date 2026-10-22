"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContactsQuerySchema = exports.createContactSchema = void 0;
const zod_1 = require("zod");
const ContactStatusEnum = zod_1.z.enum(['UNREAD', 'READ', 'REPLIED', 'ARCHIVED']);
exports.createContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, 'Full name is required').max(100),
        email: zod_1.z.string().email('Invalid email format'),
        subject: zod_1.z.string().min(1, 'Subject is required').max(200),
        message: zod_1.z.string().min(10, 'Message must be at least 10 characters').max(2000),
    }),
});
exports.getContactsQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        status: ContactStatusEnum.optional(),
        search: zod_1.z.string().optional(),
        page: zod_1.z.string().optional().default('1').transform(v => parseInt(v)),
        limit: zod_1.z.string().optional().default('20').transform(v => parseInt(v)),
    }),
});
