"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInquiriesQuerySchema = exports.reviewInquirySchema = exports.createInquirySchema = void 0;
const zod_1 = require("zod");
exports.createInquirySchema = zod_1.z.object({
    body: zod_1.z.object({
        propertyId: zod_1.z.string().cuid('Invalid property ID'),
        name: zod_1.z.string().min(1, 'Name is required'),
        location: zod_1.z.string().min(1, 'Location is required'),
        message: zod_1.z.string().min(1, 'Message is required'),
        meetingType: zod_1.z.enum(['VIDEO_CALL', 'IN_PERSON'], {
            errorMap: () => ({ message: "Meeting type must be 'VIDEO_CALL' or 'IN_PERSON'" })
        }),
        proposedDate: zod_1.z.string().datetime().optional()
    })
});
exports.reviewInquirySchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().cuid('Invalid inquiry ID')
    }),
    body: zod_1.z.object({
        status: zod_1.z.enum(['ACCEPTED', 'DECLINED']),
        reason: zod_1.z.string().optional(),
        scheduledDate: zod_1.z.string().datetime().optional()
    }).refine((data) => {
        if (data.status === 'DECLINED' && !data.reason) {
            return false;
        }
        return true;
    }, {
        message: "Reason is required when declining an inquiry",
        path: ["reason"]
    }).refine((data) => {
        if (data.status === 'ACCEPTED' && !data.scheduledDate) {
            return false;
        }
        return true;
    }, {
        message: "Scheduled date is required when accepting an inquiry",
        path: ["scheduledDate"]
    })
});
exports.getInquiriesQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        status: zod_1.z.enum(['PENDING', 'ACCEPTED', 'DECLINED']).optional(),
        propertyId: zod_1.z.string().cuid().optional(),
        page: zod_1.z.string().optional().default('1').transform(val => parseInt(val)),
        limit: zod_1.z.string().optional().default('20').transform(val => parseInt(val))
    })
});
