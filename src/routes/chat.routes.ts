import { Router } from 'express';
import {
  sendVetRequest,
  acceptVetRequest,
  rejectVetRequest,
  getVetRequests,
  getConversations,
  getMessages,
  getConversation,
  updateConversation,
  deleteConversation,
  addParticipants,
  removeParticipant,
  createConversation,
  getAvailableChatUsers,
  createMessage,
  markMessagesAsRead,
  addReaction,
  editMessage,
  deleteMessage,
  startCall,
  endCall,
  answerCall
} from '../contollers/chat.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { requireRoles } from '../middlewares/roleCheck';
import { validateRequest } from '../middlewares/validateRequest';
import {
  sendVetRequestSchema,
  rejectVetRequestSchema,
  createConversationSchema,
  updateConversationSchema,
  addParticipantsSchema,
  createMessageSchema,
  markMessagesAsReadSchema,
  addReactionSchema,
  editMessageSchema,
  deleteMessageSchema,
  startCallSchema,
  endCallSchema,
  answerCallSchema
} from '../schemas/chat.schemas';

export const chatRouter = Router();


chatRouter.post(
  '/vet-requests/:vetId/:companyId',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(sendVetRequestSchema),
  sendVetRequest
);

chatRouter.patch(
  '/vet-requests/:requestId/accept',
  authenticateJWT,
  requireRoles(['VET']),
  acceptVetRequest
);

chatRouter.patch(
  '/vet-requests/:requestId/reject',
  authenticateJWT,
  requireRoles(['VET']),
  validateRequest(rejectVetRequestSchema),
  rejectVetRequest
);

chatRouter.get(
  '/vet-requests',
  authenticateJWT,
  requireRoles(['ADMIN', 'VET']),
  getVetRequests
);


chatRouter.post(
  '/conversations',
  authenticateJWT,
  validateRequest(createConversationSchema),
  createConversation
);

chatRouter.get(
  '/conversations',
  authenticateJWT,
  getConversations
);

chatRouter.get(
  '/conversations/:conversationId',
  authenticateJWT,
  getConversation
);

chatRouter.put(
  '/conversations/:conversationId',
  authenticateJWT,
  validateRequest(updateConversationSchema),
  updateConversation
);

chatRouter.delete(
  '/conversations/:conversationId',
  authenticateJWT,
  deleteConversation
);


chatRouter.post(
  '/conversations/:conversationId/participants',
  authenticateJWT,
  validateRequest(addParticipantsSchema),
  addParticipants
);

chatRouter.delete(
  '/conversations/:conversationId/participants/:participantId',
  authenticateJWT,
  removeParticipant
);

chatRouter.get(
  '/conversations/:conversationId/messages',
  authenticateJWT,
  getMessages
);


chatRouter.get(
  '/available-users',
  authenticateJWT,
  getAvailableChatUsers
);

chatRouter.post(
  '/messages',
  authenticateJWT,
  validateRequest(createMessageSchema),
  createMessage
);

chatRouter.patch(
  '/messages/read',
  authenticateJWT,
   validateRequest(markMessagesAsReadSchema),
  markMessagesAsRead
);

chatRouter.post(
  '/messages/:messageId/reactions',
  authenticateJWT,
  validateRequest(addReactionSchema),
  addReaction
);

chatRouter.patch(
  '/messages/:messageId',
  authenticateJWT,
  validateRequest(editMessageSchema),
  editMessage
);

chatRouter.delete(
  '/messages/:messageId',
  authenticateJWT,
  validateRequest(deleteMessageSchema),
  deleteMessage
);

chatRouter.post(
  '/calls',
  authenticateJWT,
  validateRequest(startCallSchema),
  startCall
);

chatRouter.patch(
  '/calls/:callId/end',
  authenticateJWT,
  validateRequest(endCallSchema),
  endCall
);

chatRouter.patch(
  '/calls/:callId/answer',
  authenticateJWT,
  validateRequest(answerCallSchema),
  answerCall
);