import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { createDirectChatSchema, createSupportRequestSchema, requestIdSchema, resolveRequestSchema, sendMessageSchema, sessionIdSchema, setStaffStatusSchema, transferRequestSchema } from "../schemas/chat.schemas";
import { acceptRequest, cancelRequest, createDirectChat, createSupportRequest, generateSessionToken, getAvailableStaff, getChatSessionById, getMyChatSessions, getPendingRequests, getSessionMessages, getUnreadCount, initializeAgora, resolveRequest, sendMessage, setStaffStatus, transferRequest } from "../contollers/chat.controller";


export const chatRouter = Router();

// Initialize Agora (all authenticated users)
chatRouter.post(
  '/agora/initialize',
  authenticateJWT,
  initializeAgora
);

// Direct chat
chatRouter.post(
  '/direct',
  authenticateJWT,
  validateRequest(createDirectChatSchema),
  createDirectChat
);

// Support requests
chatRouter.post(
  '/support',
  authenticateJWT,
  requireRoles(['USER', 'VENDOR']),
  validateRequest(createSupportRequestSchema),
  createSupportRequest
);

chatRouter.get(
  '/support/pending',
  authenticateJWT,
  requireRoles(['STAFF', 'ADMIN']),
  getPendingRequests
);

chatRouter.patch(
  '/support/:requestId/accept',
  authenticateJWT,
  requireRoles(['STAFF', 'ADMIN']),
  validateRequest(requestIdSchema),
  acceptRequest
);

chatRouter.patch(
  '/support/:requestId/transfer',
  authenticateJWT,
  requireRoles(['STAFF', 'ADMIN']),
  validateRequest(transferRequestSchema),
  transferRequest
);

chatRouter.patch(
  '/support/:requestId/resolve',
  authenticateJWT,
  requireRoles(['STAFF', 'ADMIN']),
  validateRequest(resolveRequestSchema),
  resolveRequest
);

chatRouter.patch(
  '/support/:requestId/cancel',
  authenticateJWT,
  requireRoles(['USER', 'VENDOR']),
  validateRequest(requestIdSchema),
  cancelRequest
);

// Staff management
chatRouter.get(
  '/staff/available',
  authenticateJWT,
  requireRoles(['STAFF', 'ADMIN']),
  getAvailableStaff
);

chatRouter.patch(
  '/staff/status',
  authenticateJWT,
  requireRoles(['STAFF', 'ADMIN']),
  validateRequest(setStaffStatusSchema),
  setStaffStatus
);

// Sessions
chatRouter.get(
  '/sessions',
  authenticateJWT,
  getMyChatSessions
);

chatRouter.get(
  '/sessions/:sessionId',
  authenticateJWT,
  validateRequest(sessionIdSchema),
  getChatSessionById
);

chatRouter.get(
  '/sessions/:sessionId/messages',
  authenticateJWT,
  validateRequest(sessionIdSchema),
  getSessionMessages
);

chatRouter.post(
  '/sessions/:sessionId/token',
  authenticateJWT,
  validateRequest(sessionIdSchema),
  generateSessionToken
);

// Messages (HTTP fallback)
chatRouter.post(
  '/messages',
  authenticateJWT,
  validateRequest(sendMessageSchema),
  sendMessage
);

chatRouter.get(
  '/messages/unread',
  authenticateJWT,
  getUnreadCount
);