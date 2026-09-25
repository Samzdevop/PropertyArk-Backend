import { Server as SocketServer, Socket } from 'socket.io';
import { Server } from 'http';
import { ChatSessionService } from './chatSession.service';
import { ChatMessageService } from './chatMessage.service';
import { AgoraService } from './agora.service';
import Logger from '../config/logger';
import { Role } from '@prisma/client';
import prisma from '../prisma';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: Role;
  userEmail?: string;
}

export class SocketService {
  private static io: SocketServer | null = null;
  private static connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private static availableStaff: Set<string> = new Set(); // staffIds

  /**
   * Initialize Socket.IO server
   */
  static initialize(server: Server): SocketServer {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST']
      },
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupHandlers();

    Logger.info('Socket.IO server initialized');
    return this.io;
  }

  /**
   * Setup authentication middleware
   */
  private static setupMiddleware(): void {
    if (!this.io) return;

    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        
        // Get user from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, email: true, role: true, fullName: true }
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        socket.userEmail = user.email;

        next();
      } catch (error: any) {
        Logger.error('Socket authentication failed:', error.message);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private static setupHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      const userRole = socket.userRole!;

      Logger.info(`User connected: ${userId} (${userRole}) - Socket: ${socket.id}`);

      // Track connected user
      this.connectedUsers.set(userId, socket.id);

      // Handle staff going online
      if (userRole === Role.STAFF || userRole === Role.ADMIN) {
        this.handleStaffOnline(userId, socket.id);
      }

      // Join user's personal room
      socket.join(`user_${userId}`);

      // Handle joining chat session
      socket.on('chat:join', async (data: { sessionId: string }) => {
        try {
          const { sessionId } = data;

          // Verify access
          const session = await prisma.chatSession.findUnique({
            where: { id: sessionId },
            include: {
              participants: {
                where: { userId, isActive: true }
              }
            }
          });

          if (!session) {
            socket.emit('chat:error', { message: 'Chat session not found' });
            return;
          }

          const isParticipant = session.participants.length > 0;
          const isAdmin = userRole === Role.ADMIN;

          if (!isParticipant && !isAdmin) {
            socket.emit('chat:error', { message: 'Access denied' });
            return;
          }

          // Join the session room
          socket.join(`session_${sessionId}`);

          // Generate Agora token
          const tokenData = await ChatSessionService.generateSessionToken(
            sessionId,
            userId
          );

          socket.emit('chat:joined', {
            sessionId,
            ...tokenData
          });

          Logger.info(`User ${userId} joined chat session ${sessionId}`);
        } catch (error: any) {
          Logger.error('Chat join error:', error);
          socket.emit('chat:error', { message: error.message });
        }
      });

      // Handle leaving chat session
      socket.on('chat:leave', (data: { sessionId: string }) => {
        const { sessionId } = data;
        socket.leave(`session_${sessionId}`);
        Logger.info(`User ${userId} left chat session ${sessionId}`);
      });

      // Handle sending message
      socket.on('chat:message', async (data: {
        sessionId: string;
        content: string;
        messageType?: string;
        metadata?: any;
      }) => {
        try {
          const { sessionId, content, messageType, metadata } = data;

          const message = await ChatMessageService.saveMessage(
            sessionId,
            userId,
            content,
            messageType || 'text',
            undefined,
            metadata
          );

          // Broadcast to all participants in the session
          this.io!.to(`session_${sessionId}`).emit('chat:new-message', {
            sessionId,
            message: {
              ...message,
              sender: {
                id: message.sender.id,
                fullName: message.sender.fullName,
                avatar: message.sender.avatar,
                role: message.sender.role
              }
            }
          });

          Logger.debug(`Message sent in session ${sessionId} by ${userId}`);
        } catch (error: any) {
          Logger.error('Message send error:', error);
          socket.emit('chat:error', { message: error.message });
        }
      });

      // Handle typing indicators
      socket.on('chat:typing', (data: { sessionId: string; isTyping: boolean }) => {
        const { sessionId, isTyping } = data;
        socket.to(`session_${sessionId}`).emit('chat:user-typing', {
          sessionId,
          userId,
          isTyping
        });
      });

      // Handle message read
      socket.on('chat:read', async (data: { sessionId: string }) => {
        try {
          const { sessionId } = data;
          await ChatMessageService.markMessagesAsRead(sessionId, userId);

          socket.to(`session_${sessionId}`).emit('chat:messages-read', {
            sessionId,
            userId,
            readAt: new Date()
          });
        } catch (error: any) {
          Logger.error('Mark read error:', error);
        }
      });

      // Handle staff request assignment
      socket.on('staff:accept-request', async (data: { requestId: string }) => {
        try {
          if (userRole !== Role.STAFF && userRole !== Role.ADMIN) {
            socket.emit('staff:error', { message: 'Only staff can accept requests' });
            return;
          }

          const { requestId } = data;
          const result = await ChatSessionService.assignRequestToStaff(requestId, userId);

          // Notify the user
          const session = await prisma.chatSession.findUnique({
            where: { id: result.session.id },
            include: {
              participants: true
            }
          });

          if (session) {
            const userIds = session.participants.map(p => p.userId);
            userIds.forEach(uid => {
              this.io!.to(`user_${uid}`).emit('chat:session-assigned', {
                sessionId: session.id,
                assignedStaffId: userId
              });
            });
          }

          socket.emit('staff:request-accepted', { requestId });
          Logger.info(`Staff ${userId} accepted request ${requestId}`);
        } catch (error: any) {
          Logger.error('Accept request error:', error);
          socket.emit('staff:error', { message: error.message });
        }
      });

      // Handle transfer request
      socket.on('staff:transfer-request', async (data: {
        requestId: string;
        toStaffId: string;
        reason?: string;
      }) => {
        try {
          if (userRole !== Role.STAFF && userRole !== Role.ADMIN) {
            socket.emit('staff:error', { message: 'Only staff can transfer requests' });
            return;
          }

          const { requestId, toStaffId, reason } = data;

          const result = await ChatSessionService.transferRequest(
            requestId,
            userId,
            toStaffId,
            reason
          );

          // Notify the target staff
          this.io!.to(`user_${toStaffId}`).emit('staff:request-transferred-to-you', {
            requestId,
            fromStaffId: userId
          });

          // Notify the user
          const request = await prisma.chatRequest.findUnique({
            where: { id: requestId },
            include: { session: true }
          });

          if (request) {
            this.io!.to(`user_${request.userId}`).emit('chat:staff-changed', {
              sessionId: request.session.id,
              newStaffId: toStaffId
            });
          }

          socket.emit('staff:request-transferred', { requestId });
          Logger.info(`Staff ${userId} transferred request ${requestId} to ${toStaffId}`);
        } catch (error: any) {
          Logger.error('Transfer request error:', error);
          socket.emit('staff:error', { message: error.message });
        }
      });

      // Handle resolve request
      socket.on('staff:resolve-request', async (data: {
        requestId: string;
        resolutionNote?: string;
      }) => {
        try {
          if (userRole !== Role.STAFF && userRole !== Role.ADMIN) {
            socket.emit('staff:error', { message: 'Only staff can resolve requests' });
            return;
          }

          const { requestId, resolutionNote } = data;

          const result = await ChatSessionService.resolveRequest(
            requestId,
            userId,
            resolutionNote
          );

          // Get session to notify participants
          const request = await prisma.chatRequest.findUnique({
            where: { id: requestId },
            include: {
              session: {
                include: {
                  participants: true
                }
              }
            }
          });

          if (request) {
            this.io!.to(`session_${request.session.id}`).emit('chat:session-ended', {
              sessionId: request.session.id,
              resolvedBy: userId,
              resolutionNote
            });

            // Notify user
            this.io!.to(`user_${request.userId}`).emit('chat:request-resolved', {
              requestId,
              resolvedBy: userId
            });
          }

          socket.emit('staff:request-resolved', { requestId });
          Logger.info(`Staff ${userId} resolved request ${requestId}`);
        } catch (error: any) {
          Logger.error('Resolve request error:', error);
          socket.emit('staff:error', { message: error.message });
        }
      });

      // Handle available staff list request
      socket.on('staff:get-available', async () => {
        try {
          const availableStaff = await ChatSessionService.getAvailableStaff();
          socket.emit('staff:available-list', availableStaff);
        } catch (error: any) {
          Logger.error('Get available staff error:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        Logger.info(`User disconnected: ${userId} - Socket: ${socket.id}`);
        
        // Remove from connected users
        if (this.connectedUsers.get(userId) === socket.id) {
          this.connectedUsers.delete(userId);
        }

        // Update staff status if staff
        if (userRole === Role.STAFF || userRole === Role.ADMIN) {
          await this.handleStaffOffline(userId);
        }
      });
    });
  }

  /**
   * Handle staff going online
   */
  private static async handleStaffOnline(staffId: string, socketId: string): Promise<void> {
    try {
      await ChatSessionService.setStaffStatus(staffId, {
        isOnline: true,
        isAvailable: true,
        socketId
      });

      this.availableStaff.add(staffId);

      // Notify pending users that staff is available
      await this.notifyPendingUsers();

      Logger.info(`Staff ${staffId} is now online and available`);
    } catch (error) {
      Logger.error(`Failed to set staff online: ${error}`);
    }
  }

  /**
   * Handle staff going offline
   */
  private static async handleStaffOffline(staffId: string): Promise<void> {
    try {
      await ChatSessionService.setStaffStatus(staffId, {
        isOnline: false,
        isAvailable: false
      });

      this.availableStaff.delete(staffId);

      // Reassign their active chats to other available staff
      await this.reassignActiveChats(staffId);

      Logger.info(`Staff ${staffId} is now offline`);
    } catch (error) {
      Logger.error(`Failed to set staff offline: ${error}`);
    }
  }

  /**
   * Notify pending users that staff is available
   */
  private static async notifyPendingUsers(): Promise<void> {
    try {
      // Get pending requests
      const pendingRequests = await prisma.chatRequest.findMany({
        where: {
          status: 'PENDING'
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true }
          }
        }
      });

      // Notify available staff about pending requests
      const availableStaff = await ChatSessionService.getAvailableStaff();
      
      for (const staff of availableStaff) {
        const staffSocketId = this.connectedUsers.get(staff.staffId);
        if (staffSocketId) {
          this.io!.to(staffSocketId).emit('staff:pending-requests', {
            requests: pendingRequests,
            count: pendingRequests.length
          });
        }
      }
    } catch (error) {
      Logger.error('Failed to notify pending users:', error);
    }
  }

  /**
   * Reassign active chats when staff goes offline
   */
  private static async reassignActiveChats(staffId: string): Promise<void> {
    try {
      // Get active chats for this staff
      const activeChats = await prisma.chatRequest.findMany({
        where: {
          assignedStaffId: staffId,
          status: 'ASSIGNED'
        }
      });

      if (activeChats.length === 0) return;

      // Get available staff
      const availableStaff = await ChatSessionService.getAvailableStaff();

      for (const chat of activeChats) {
        if (availableStaff.length > 0) {
          // Find staff with least active chats
          const targetStaff = availableStaff.sort((a, b) => a.activeChats - b.activeChats)[0];

          try {
            await ChatSessionService.transferRequest(
              chat.id,
              staffId,
              targetStaff.staffId,
              'Staff went offline - auto-reassigned'
            );

            // Notify new staff
            const staffSocketId = this.connectedUsers.get(targetStaff.staffId);
            if (staffSocketId) {
              this.io!.to(staffSocketId).emit('staff:request-transferred-to-you', {
                requestId: chat.id,
                fromStaffId: staffId,
                reason: 'Auto-reassigned (previous staff went offline)'
              });
            }

            // Notify user
            this.io!.to(`user_${chat.userId}`).emit('chat:staff-changed', {
              sessionId: chat.sessionId,
              newStaffId: targetStaff.staffId
            });
          } catch (error) {
            Logger.error(`Failed to reassign chat ${chat.id}:`, error);
          }
        } else {
          // No staff available - put back in queue
          await prisma.chatRequest.update({
            where: { id: chat.id },
            data: {
              status: 'PENDING',
              assignedStaffId: null,
              assignedAt: null
            }
          });

          // Notify user
          this.io!.to(`user_${chat.userId}`).emit('chat:staff-unavailable', {
            sessionId: chat.sessionId,
            message: 'Your support agent has gone offline. You will be reassigned shortly.'
          });
        }
      }

      Logger.info(`Reassigned ${activeChats.length} chats from offline staff ${staffId}`);
    } catch (error) {
      Logger.error('Failed to reassign active chats:', error);
    }
  }

  /**
   * Get IO instance
   */
  static getIO(): SocketServer {
    if (!this.io) {
      throw new Error('Socket.IO not initialized');
    }
    return this.io;
  }

  /**
   * Send notification to specific user
   */
  static sendToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user_${userId}`).emit(event, data);
    }
  }

  /**
   * Send notification to session
   */
  static sendToSession(sessionId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`session_${sessionId}`).emit(event, data);
    }
  }

  /**
   * Broadcast to all connected users
   */
  static broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  /**
   * Get connected users count
   */
  static getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is online
   */
  static isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}