import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { ChatSessionService } from "../services/chatSession.service";
import { ChatMessageService } from "../services/chatMessage.service";
import { AgoraService } from "../services/agora.service";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role, ChatType, ChatSessionStatus, ChatRequestStatus } from "@prisma/client";

/**
 * Initialize Agora token for current user
 */
export const initializeAgora = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    // Generate Agora user ID
    const agoraUserId = `user_${user.id}`;

    // Register user in Agora if not exists
    await AgoraService.registerUser(agoraUserId, user.fullName);

    // Generate token
    const token = AgoraService.generateChatToken(agoraUserId, 86400);

    await logActivity(
      user.id,
      'INITIALIZE_AGORA',
      'CHAT',
      user.id,
      {},
      req
    );

    sendSuccessResponse(res, "Agora initialized successfully", {
      agoraUserId,
      agoraAppId: process.env.AGORA_APP_ID,
      token,
      expiresIn: 86400
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create direct chat
 */
export const createDirectChat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { participantId, subject, propertyId } = req.body;

    const session = await ChatSessionService.createDirectChat(
      user.id,
      participantId,
      subject,
      propertyId
    );

    await logActivity(
      user.id,
      'CREATE_DIRECT_CHAT',
      'CHAT',
      session.id,
      {
        sessionNumber: session.sessionNumber,
        participantId
      },
      req
    );

    sendSuccessResponse(res, "Chat created successfully", session, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Create support request
 */
export const createSupportRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { subject, description, priority } = req.body;

    const result = await ChatSessionService.createSupportRequest(
      user.id,
      subject,
      description,
      priority
    );

    await logActivity(
      user.id,
      'CREATE_SUPPORT_REQUEST',
      'CHAT',
      result.request.id,
      {
        requestNumber: result.request.requestNumber,
        subject,
        priority
      },
      req
    );

    // Notify available staff via socket
    try {
      const { SocketService } = await import('../services/socket.service');
      SocketService.broadcast('staff:new-request', {
        request: result.request,
        session: result.session
      });
    } catch (error) {
      // Socket might not be initialized
    }

    sendSuccessResponse(
      res,
      "Support request created. A staff member will be with you shortly.",
      result,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get my chat sessions
 */
export const getMyChatSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { type, status, page = 1, limit = 20 } = req.query;

    const result = await ChatSessionService.getUserChatSessions(user.id, {
      type: type as ChatType,
      status: status as ChatSessionStatus,
      page: Number(page),
      limit: Number(limit)
    });

    sendSuccessResponse(res, "Chat sessions retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get chat session by ID
 */
export const getChatSessionById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { sessionId } = req.params;

    const session = await ChatSessionService.getChatSessionById(
      sessionId as string,
      user.id,
      user.role
    );

    sendSuccessResponse(res, "Chat session retrieved successfully", session);
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages for a session
 */
export const getSessionMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await ChatMessageService.getSessionMessages(
      sessionId as string,
      user.id,
      user.role,
      Number(page),
      Number(limit)
    );

    sendSuccessResponse(res, "Messages retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Send message via HTTP (fallback)
 */
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { sessionId, content, messageType, metadata } = req.body;

    const message = await ChatMessageService.saveMessage(
      sessionId,
      user.id,
      content,
      messageType || 'text',
      undefined,
      metadata
    );

    // Broadcast via socket
    try {
      const { SocketService } = await import('../services/socket.service');
      SocketService.sendToSession(sessionId, 'chat:new-message', {
        sessionId,
        message
      });
    } catch (error) {
      // Socket might not be initialized
    }

    sendSuccessResponse(res, "Message sent successfully", message, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread message count
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    const count = await ChatMessageService.getUnreadCount(user.id);

    sendSuccessResponse(res, "Unread count retrieved", { count });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending support requests (Staff/Admin only)
 */
export const getPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.STAFF && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only staff and admins can view pending requests");
    }

    const { status, priority, page = 1, limit = 20 } = req.query;

    const result = await ChatSessionService.getPendingRequests({
      status: status as ChatRequestStatus,
      priority: priority as string,
      page: Number(page),
      limit: Number(limit)
    });

    sendSuccessResponse(res, "Pending requests retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Accept a support request (Staff only)
 */
export const acceptRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.STAFF && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only staff and admins can accept requests");
    }

    const { requestId } = req.params;

    const result = await ChatSessionService.assignRequestToStaff(
      requestId as string,
      user.id
    );

    await logActivity(
      user.id,
      'ACCEPT_SUPPORT_REQUEST',
      'CHAT',
      requestId as string,
      {
        requestNumber: result.request.requestNumber
      },
      req
    );

    // Notify via socket
    try {
      const { SocketService } = await import('../services/socket.service');
      SocketService.sendToUser(result.request.userId, 'chat:request-accepted', {
        requestId,
        staffId: user.id
      });
    } catch (error) {
      // Socket might not be initialized
    }

    sendSuccessResponse(res, "Request accepted successfully", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer a support request (Staff only)
 */
export const transferRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.STAFF && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only staff and admins can transfer requests");
    }

    const { requestId } = req.params;
    const { toStaffId, reason } = req.body;

    const result = await ChatSessionService.transferRequest(
      requestId as string,
      user.id,
      toStaffId,
      reason
    );

    await logActivity(
      user.id,
      'TRANSFER_SUPPORT_REQUEST',
      'CHAT',
      requestId as string,
      { toStaffId, reason },
      req
    );

    // Notify via socket
    try {
      const { SocketService } = await import('../services/socket.service');
      SocketService.sendToUser(toStaffId, 'chat:request-transferred-to-you', {
        requestId,
        fromStaffId: user.id,
        reason
      });
    } catch (error) {
      // Socket might not be initialized
    }

    sendSuccessResponse(res, "Request transferred successfully", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve a support request (Staff only)
 */
export const resolveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.STAFF && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only staff and admins can resolve requests");
    }

    const { requestId } = req.params;
    const { resolutionNote } = req.body;

    const result = await ChatSessionService.resolveRequest(
      requestId as string,
      user.id,
      resolutionNote
    );

    await logActivity(
      user.id,
      'RESOLVE_SUPPORT_REQUEST',
      'CHAT',
      requestId as string,
      { resolutionNote },
      req
    );

    sendSuccessResponse(res, "Request resolved successfully", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a support request (User only)
 */
export const cancelRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { requestId } = req.params;

    const result = await ChatSessionService.cancelRequest(
      requestId as string,
      user.id
    );

    await logActivity(
      user.id,
      'CANCEL_SUPPORT_REQUEST',
      'CHAT',
      requestId as string,
      {},
      req
    );

    sendSuccessResponse(res, "Request cancelled successfully", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get available staff (Staff/Admin only)
 */
export const getAvailableStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.STAFF && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only staff and admins can view available staff");
    }

    const staff = await ChatSessionService.getAvailableStaff();

    sendSuccessResponse(res, "Available staff retrieved successfully", staff);
  } catch (error) {
    next(error);
  }
};

// Set staff status (Staff only)
export const setStaffStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (user.role !== Role.STAFF && user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only staff and admins can set their status");
    }

    const { isOnline, isAvailable, maxChats } = req.body;

    const status = await ChatSessionService.setStaffStatus(user.id, {
      isOnline,
      isAvailable,
      maxChats
    });

    sendSuccessResponse(res, "Staff status updated successfully", status);
  } catch (error) {
    next(error);
  }
};

//Generate session token
export const generateSessionToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { sessionId } = req.params;

    const tokenData = await ChatSessionService.generateSessionToken(
      sessionId as string,
      user.id
    );

    sendSuccessResponse(res, "Session token generated successfully", tokenData);
  } catch (error) {
    next(error);
  }
};