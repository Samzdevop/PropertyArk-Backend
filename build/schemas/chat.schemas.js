"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.answerCallSchema = exports.endCallSchema = exports.startCallSchema = exports.addReactionSchema = exports.editMessageSchema = exports.deleteMessageSchema = exports.markMessagesAsReadSchema = exports.createMessageSchema = exports.addParticipantsSchema = exports.updateConversationSchema = exports.createConversationSchema = exports.rejectVetRequestSchema = exports.sendVetRequestSchema = void 0;
const zod_1 = require("zod");
exports.sendVetRequestSchema = zod_1.z.object({
    params: zod_1.z.object({
        vetId: zod_1.z.string(),
        companyId: zod_1.z.string()
    }),
    body: zod_1.z.object({
        message: zod_1.z.string().optional()
    })
});
exports.rejectVetRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().optional()
    })
});
exports.createConversationSchema = zod_1.z.object({
    body: zod_1.z.object({
        participantIds: zod_1.z.array(zod_1.z.string().min(1, "Participant ID is required")).min(1, "At least one participant is required"),
        isGroup: zod_1.z.boolean().optional().default(false),
        groupName: zod_1.z.string().optional(),
        groupImage: zod_1.z.string().url("Group image must be a valid URL").optional()
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
exports.updateConversationSchema = zod_1.z.object({
    body: zod_1.z.object({
        groupName: zod_1.z.string().optional(),
        groupImage: zod_1.z.string().url("Group image must be a valid URL").optional()
    })
});
exports.addParticipantsSchema = zod_1.z.object({
    body: zod_1.z.object({
        participantIds: zod_1.z.array(zod_1.z.string().min(1, "Participant ID is required")).min(1, "At least one participant is required")
    })
});
exports.createMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        conversationId: zod_1.z.string().min(1, "Conversation ID is required"),
        content: zod_1.z.string().min(1, "Message content is required"),
        messageType: zod_1.z.enum(['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT', 'SYSTEM']).default('TEXT'),
        mediaUrl: zod_1.z.string().url("Media URL must be a valid URL").optional(),
        fileName: zod_1.z.string().optional(),
        fileSize: zod_1.z.number().optional(),
        parentMessageId: zod_1.z.string().optional(),
        encryptedKey: zod_1.z.string().optional(),
        messageId: zod_1.z.string().optional()
    })
});
exports.markMessagesAsReadSchema = zod_1.z.object({
    body: zod_1.z.object({
        messageIds: zod_1.z.array(zod_1.z.string().min(1, "Message ID is required")).min(1, "At least one message ID is required"),
        conversationId: zod_1.z.string().min(1, "Conversation ID is required")
    })
});
exports.deleteMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        deleteForEveryone: zod_1.z.boolean().default(false)
    })
});
exports.editMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string().min(1, "Message content is required")
    })
});
exports.addReactionSchema = zod_1.z.object({
    body: zod_1.z.object({
        emoji: zod_1.z.string().min(1, "Emoji is required").max(10, "Emoji too long")
    })
});
exports.startCallSchema = zod_1.z.object({
    body: zod_1.z.object({
        conversationId: zod_1.z.string().min(1, "Conversation ID is required"),
        callType: zod_1.z.string().default('audio')
    })
});
exports.endCallSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().optional()
    })
});
exports.answerCallSchema = zod_1.z.object({
    body: zod_1.z.object({
        accept: zod_1.z.boolean()
    })
});
