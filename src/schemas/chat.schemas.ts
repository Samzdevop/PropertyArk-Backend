import { z } from "zod";

export const createDirectChatSchema = z.object({
  body: z.object({
    participantId: z.string().cuid("Invalid participant ID"),
    subject: z.string().optional(),
    propertyId: z.string().cuid().optional()
  })
});

export const createSupportRequestSchema = z.object({
  body: z.object({
    subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
    description: z.string().max(1000, "Description too long").optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL')
  })
});

export const sendMessageSchema = z.object({
  body: z.object({
    sessionId: z.string().cuid("Invalid session ID"),
    content: z.string().min(1, "Message cannot be empty").max(5000, "Message too long"),
    messageType: z.enum(['text', 'image', 'file']).optional().default('text'),
    metadata: z.any().optional()
  })
});

export const transferRequestSchema = z.object({
  params: z.object({
    requestId: z.string().cuid("Invalid request ID")
  }),
  body: z.object({
    toStaffId: z.string().cuid("Invalid staff ID"),
    reason: z.string().optional()
  })
});

export const resolveRequestSchema = z.object({
  params: z.object({
    requestId: z.string().cuid("Invalid request ID")
  }),
  body: z.object({
    resolutionNote: z.string().optional()
  })
});

export const setStaffStatusSchema = z.object({
  body: z.object({
    isOnline: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    maxChats: z.number().min(1).max(10).optional()
  })
});

export const sessionIdSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid("Invalid session ID")
  })
});

export const requestIdSchema = z.object({
  params: z.object({
    requestId: z.string().cuid("Invalid request ID")
  })
});