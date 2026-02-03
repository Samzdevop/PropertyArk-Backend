import { z } from 'zod';

export const sendVetRequestSchema = z.object({
  params: z.object({
    vetId: z.string(),
    companyId: z.string()
  }),
  body: z.object({
    message: z.string().optional()
  })
});

export const rejectVetRequestSchema = z.object({
  body: z.object({
    reason: z.string().optional()
  })
});

export const createConversationSchema = z.object({
  body: z.object({
    participantIds: z.array(z.string().min(1, "Participant ID is required")).min(1, "At least one participant is required"),
    isGroup: z.boolean().optional().default(false),
    groupName: z.string().optional(),
    groupImage: z.string().url("Group image must be a valid URL").optional()
  }).refine(data => {
    if (data.isGroup && !data.groupName) {
      return false;
    }
    return true;
  }, {
    message: "Group name is required for group conversations",
    path: ["groupName"]
  })
});

export const updateConversationSchema = z.object({
  body: z.object({
    groupName: z.string().optional(),
    groupImage: z.string().url("Group image must be a valid URL").optional()
  })
});

export const addParticipantsSchema = z.object({
  body: z.object({
    participantIds: z.array(z.string().min(1, "Participant ID is required")).min(1, "At least one participant is required")
  })
});

export const createMessageSchema = z.object({
  body: z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
    content: z.string().min(1, "Message content is required"),
    messageType: z.enum(['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT', 'SYSTEM']).default('TEXT'),
    mediaUrl: z.string().url("Media URL must be a valid URL").optional(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    parentMessageId: z.string().optional(),
    encryptedKey: z.string().optional(),
    messageId: z.string().optional()
  })
});

export const markMessagesAsReadSchema = z.object({
  body: z.object({
    messageIds: z.array(z.string().min(1, "Message ID is required")).min(1, "At least one message ID is required"),
    conversationId: z.string().min(1, "Conversation ID is required")
  })
});

export const deleteMessageSchema = z.object({
  body: z.object({
    deleteForEveryone: z.boolean().default(false)
  })
});

export const editMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Message content is required")
  })
});

export const addReactionSchema = z.object({
  body: z.object({
    emoji: z.string().min(1, "Emoji is required").max(10, "Emoji too long")
  })
});

export const startCallSchema = z.object({
  body: z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
    callType: z.string().default('audio')
  })
});

export const endCallSchema = z.object({
  body: z.object({
    reason: z.string().optional()
  })
});

export const answerCallSchema = z.object({
  body: z.object({
    accept: z.boolean()
  })
});