"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdSchema = exports.sessionIdSchema = exports.setStaffStatusSchema = exports.resolveRequestSchema = exports.transferRequestSchema = exports.sendMessageSchema = exports.createSupportRequestSchema = exports.createDirectChatSchema = void 0;
const zod_1 = require("zod");
exports.createDirectChatSchema = zod_1.z.object({
    body: zod_1.z.object({
        participantId: zod_1.z.string().cuid("Invalid participant ID"),
        subject: zod_1.z.string().optional(),
        propertyId: zod_1.z.string().cuid().optional()
    })
});
exports.createSupportRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        subject: zod_1.z.string().min(1, "Subject is required").max(200, "Subject too long"),
        description: zod_1.z.string().max(1000, "Description too long").optional(),
        priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL')
    })
});
exports.sendMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        sessionId: zod_1.z.string().cuid("Invalid session ID"),
        content: zod_1.z.string().min(1, "Message cannot be empty").max(5000, "Message too long"),
        messageType: zod_1.z.enum(['text', 'image', 'file']).optional().default('text'),
        metadata: zod_1.z.any().optional()
    })
});
exports.transferRequestSchema = zod_1.z.object({
    params: zod_1.z.object({
        requestId: zod_1.z.string().cuid("Invalid request ID")
    }),
    body: zod_1.z.object({
        toStaffId: zod_1.z.string().cuid("Invalid staff ID"),
        reason: zod_1.z.string().optional()
    })
});
exports.resolveRequestSchema = zod_1.z.object({
    params: zod_1.z.object({
        requestId: zod_1.z.string().cuid("Invalid request ID")
    }),
    body: zod_1.z.object({
        resolutionNote: zod_1.z.string().optional()
    })
});
exports.setStaffStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        isOnline: zod_1.z.boolean().optional(),
        isAvailable: zod_1.z.boolean().optional(),
        maxChats: zod_1.z.number().min(1).max(10).optional()
    })
});
exports.sessionIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        sessionId: zod_1.z.string().cuid("Invalid session ID")
    })
});
exports.requestIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        requestId: zod_1.z.string().cuid("Invalid request ID")
    })
});
