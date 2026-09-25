import prisma from "../prisma";
import { 
  Role, 
  ChatType, 
  ChatSessionStatus, 
  ChatRequestStatus, 
  ChatParticipantRole 
} from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import Logger from "../config/logger";
import { AgoraService } from "./agora.service";

export class ChatSessionService {

  private static generateSessionNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CHT-${year}-${random}`;
  }

  private static generateRequestNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `REQ-${year}-${random}`;
  }

  private static getRoleString(role: Role): ChatParticipantRole {
    switch (role) {
      case Role.USER: return ChatParticipantRole.USER;
      case Role.VENDOR: return ChatParticipantRole.VENDOR;
      case Role.STAFF: return ChatParticipantRole.STAFF;
      case Role.ADMIN: return ChatParticipantRole.ADMIN;
      default: return ChatParticipantRole.USER;
    }
  }

  /**
   * Create a direct chat between two users (User-User, Vendor-Vendor, User-Vendor)
   */
  static async createDirectChat(
    initiatorId: string,
    participantId: string,
    subject?: string,
    propertyId?: string
  ): Promise<any> {
    // Get both users
    const [initiator, participant] = await Promise.all([
      prisma.user.findUnique({
        where: { id: initiatorId },
        select: { id: true, fullName: true, role: true, email: true }
      }),
      prisma.user.findUnique({
        where: { id: participantId },
        select: { id: true, fullName: true, role: true, email: true }
      })
    ]);

    if (!initiator) {
      throw new NotFoundError("Initiator not found");
    }

    if (!participant) {
      throw new NotFoundError("Participant not found");
    }

    if (initiatorId === participantId) {
      throw new BadRequestError("Cannot create chat with yourself");
    }

    // Validate role combinations for direct chat
    const allowedPairs = [
      // User <-> Vendor
      [Role.USER, Role.VENDOR],
      [Role.VENDOR, Role.USER],
      // User <-> User
      [Role.USER, Role.USER],
      // Vendor <-> Vendor
      [Role.VENDOR, Role.VENDOR],
    ];

    const isValidPair = allowedPairs.some(
      ([r1, r2]) => initiator.role === r1 && participant.role === r2
    );

    if (!isValidPair) {
      throw new ForbiddenError(
        `Direct chat between ${initiator.role} and ${participant.role} is not allowed. For support, use the support request endpoint.`
      );
    }

    // Check if there's an existing active chat between these two users
    const existingSession = await prisma.chatSession.findFirst({
      where: {
        type: ChatType.DIRECT,
        status: ChatSessionStatus.ACTIVE,
        AND: [
          { participants: { some: { userId: initiatorId } } },
          { participants: { some: { userId: participantId } } }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, fullName: true, role: true, avatar: true }
            }
          }
        }
      }
    });

    if (existingSession) {
      return existingSession;
    }

    // Create Agora channel name (unique per session)
    const agoraChannel = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create chat session
    const session = await prisma.chatSession.create({
      data: {
        sessionNumber: this.generateSessionNumber(),
        type: ChatType.DIRECT,
        status: ChatSessionStatus.ACTIVE,
        agoraChannel,
        initiatorId,
        initiatorRole: this.getRoleString(initiator.role),
        subject: subject || `Chat between ${initiator.fullName} and ${participant.fullName}`,
        propertyId: propertyId || null,
        participants: {
          create: [
            {
              userId: initiatorId,
              role: this.getRoleString(initiator.role),
              isActive: true
            },
            {
              userId: participantId,
              role: this.getRoleString(participant.role),
              isActive: true
            }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, fullName: true, role: true, avatar: true, email: true }
            }
          }
        },
        property: {
          select: { id: true, name: true, address: true }
        }
      }
    });

    Logger.info(`Direct chat created: ${session.sessionNumber} between ${initiator.email} and ${participant.email}`);
    return session;
  }

  /**
   * Create a support chat request (User/Vendor -> Admin/Staff)
   */
  static async createSupportRequest(
    initiatorId: string,
    subject: string,
    description?: string,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<any> {
    // Get initiator
    const initiator = await prisma.user.findUnique({
      where: { id: initiatorId },
      select: { id: true, fullName: true, role: true, email: true }
    });

    if (!initiator) {
      throw new NotFoundError("User not found");
    }

    // Only USER and VENDOR can create support requests
    if (initiator.role !== Role.USER && initiator.role !== Role.VENDOR) {
      throw new ForbiddenError("Only users and vendors can create support requests");
    }

    // Check for existing pending request from this user
    const existingRequest = await prisma.chatRequest.findFirst({
      where: {
        userId: initiatorId,
        status: { in: [ChatRequestStatus.PENDING, ChatRequestStatus.ASSIGNED] }
      }
    });

    if (existingRequest) {
      throw new BadRequestError(
        "You already have an active support request. Please wait for it to be resolved or cancel it."
      );
    }

    // Create Agora channel
    const agoraChannel = `support_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create chat session + request in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.chatSession.create({
        data: {
          sessionNumber: this.generateSessionNumber(),
          type: ChatType.SUPPORT,
          status: ChatSessionStatus.ACTIVE,
          agoraChannel,
          initiatorId,
          initiatorRole: this.getRoleString(initiator.role),
          subject,
          participants: {
            create: [
              {
                userId: initiatorId,
                role: this.getRoleString(initiator.role),
                isActive: true
              }
            ]
          }
        }
      });

      const request = await tx.chatRequest.create({
        data: {
          requestNumber: this.generateRequestNumber(),
          sessionId: session.id,
          userId: initiatorId,
          userRole: this.getRoleString(initiator.role),
          subject,
          description: description || null,
          priority,
          status: ChatRequestStatus.PENDING
        }
      });

      return { session, request };
    });

    // Notify admin/staff via socket (will be handled in socket service)
    Logger.info(`Support request created: ${result.request.requestNumber} by ${initiator.email}`);

    return {
      ...result.session,
      request: result.request
    };
  }

  /**
   * Assign a support request to a staff member
   */
  static async assignRequestToStaff(
    requestId: string,
    staffId: string
  ): Promise<any> {
    // Get staff
    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, fullName: true, role: true, email: true }
    });

    if (!staff) {
      throw new NotFoundError("Staff not found");
    }

    if (staff.role !== Role.STAFF && staff.role !== Role.ADMIN) {
      throw new ForbiddenError("Only staff and admins can be assigned to support requests");
    }

    // Get request
    const request = await prisma.chatRequest.findUnique({
      where: { id: requestId },
      include: {
        session: {
          include: {
            participants: {
              include: {
                user: { select: { id: true, fullName: true, email: true } }
              }
            }
          }
        }
      }
    });

    if (!request) {
      throw new NotFoundError("Support request not found");
    }

    if (request.status !== ChatRequestStatus.PENDING) {
      throw new BadRequestError(`Request is already ${request.status.toLowerCase()}`);
    }

    // Get staff status
    const staffStatus = await prisma.staffStatus.findUnique({
      where: { staffId }
    });

    if (staffStatus && staffStatus.activeChats >= staffStatus.maxChats) {
      throw new BadRequestError("Staff member has reached maximum concurrent chats");
    }

    // Assign in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update request
      const updatedRequest = await tx.chatRequest.update({
        where: { id: requestId },
        data: {
          status: ChatRequestStatus.ASSIGNED,
          assignedStaffId: staffId,
          assignedAt: new Date()
        }
      });

      // Update session
      const updatedSession = await tx.chatSession.update({
        where: { id: request.sessionId },
        data: {
          assignedToId: staffId
        }
      });

      // Add staff as participant
      await tx.chatParticipant.create({
        data: {
          sessionId: request.sessionId,
          userId: staffId,
          role: this.getRoleString(staff.role),
          isActive: true
        }
      });

      // Update staff status
      await tx.staffStatus.upsert({
        where: { staffId },
        update: {
          activeChats: { increment: 1 },
          isAvailable: false
        },
        create: {
          staffId,
          isOnline: true,
          isAvailable: false,
          activeChats: 1
        }
      });

      return { request: updatedRequest, session: updatedSession };
    });

    Logger.info(`Support request ${request.requestNumber} assigned to ${staff.email}`);
    return result;
  }

  /**
   * Transfer a support request to another staff member
   */
  static async transferRequest(
    requestId: string,
    fromStaffId: string,
    toStaffId: string,
    reason?: string
  ): Promise<any> {
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

    if (!request) {
      throw new NotFoundError("Support request not found");
    }

    if (request.assignedStaffId !== fromStaffId) {
      throw new ForbiddenError("You are not assigned to this request");
    }

    if (request.status !== ChatRequestStatus.ASSIGNED) {
      throw new BadRequestError(`Cannot transfer request with status ${request.status}`);
    }

    // Verify target staff
    const targetStaff = await prisma.user.findUnique({
      where: { id: toStaffId },
      select: { id: true, fullName: true, role: true, email: true }
    });

    if (!targetStaff) {
      throw new NotFoundError("Target staff not found");
    }

    if (targetStaff.role !== Role.STAFF && targetStaff.role !== Role.ADMIN) {
      throw new ForbiddenError("Can only transfer to staff or admin");
    }

    // Check target staff capacity
    const targetStatus = await prisma.staffStatus.findUnique({
      where: { staffId: toStaffId }
    });

    if (targetStatus && targetStatus.activeChats >= targetStatus.maxChats) {
      throw new BadRequestError("Target staff has reached maximum concurrent chats");
    }

    // Perform transfer in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Add transfer to history
      const transferHistory = (request.transferHistory as any[]) || [];
      transferHistory.push({
        fromStaffId,
        toStaffId,
        reason,
        transferredAt: new Date().toISOString()
      });

      // Update request
      const updatedRequest = await tx.chatRequest.update({
        where: { id: requestId },
        data: {
          assignedStaffId: toStaffId,
          assignedAt: new Date(),
          transferHistory
        }
      });

      // Update session
      await tx.chatSession.update({
        where: { id: request.sessionId },
        data: {
          assignedToId: toStaffId,
          status: ChatSessionStatus.TRANSFERRED
        }
      });

      // Remove old staff from participants
      await tx.chatParticipant.updateMany({
        where: {
          sessionId: request.sessionId,
          userId: fromStaffId
        },
        data: {
          isActive: false,
          leftAt: new Date()
        }
      });

      // Add new staff as participant
      await tx.chatParticipant.create({
        data: {
          sessionId: request.sessionId,
          userId: toStaffId,
          role: this.getRoleString(targetStaff.role),
          isActive: true
        }
      });

      // Update old staff status
      await tx.staffStatus.updateMany({
        where: { staffId: fromStaffId },
        data: {
          activeChats: { decrement: 1 },
          isAvailable: true
        }
      });

      // Update new staff status
      await tx.staffStatus.upsert({
        where: { staffId: toStaffId },
        update: {
          activeChats: { increment: 1 },
          isAvailable: false
        },
        create: {
          staffId: toStaffId,
          isOnline: true,
          isAvailable: false,
          activeChats: 1
        }
      });

      // Restore session status
      await tx.chatSession.update({
        where: { id: request.sessionId },
        data: { status: ChatSessionStatus.ACTIVE }
      });

      return updatedRequest;
    });

    Logger.info(`Support request ${request.requestNumber} transferred from ${fromStaffId} to ${toStaffId}`);
    return result;
  }

  /**
   * Resolve a support request
   */
  static async resolveRequest(
    requestId: string,
    staffId: string,
    resolutionNote?: string
  ): Promise<any> {
    const request = await prisma.chatRequest.findUnique({
      where: { id: requestId },
      include: {
        session: true
      }
    });

    if (!request) {
      throw new NotFoundError("Support request not found");
    }

    if (request.assignedStaffId !== staffId) {
      throw new ForbiddenError("You are not assigned to this request");
    }

    if (request.status !== ChatRequestStatus.ASSIGNED) {
      throw new BadRequestError(`Cannot resolve request with status ${request.status}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update request
      const updatedRequest = await tx.chatRequest.update({
        where: { id: requestId },
        data: {
          status: ChatRequestStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionNote: resolutionNote || null
        }
      });

      // End session
      await tx.chatSession.update({
        where: { id: request.sessionId },
        data: {
          status: ChatSessionStatus.ENDED,
          endedAt: new Date(),
          endedBy: staffId
        }
      });

      // Update staff status
      await tx.staffStatus.updateMany({
        where: { staffId },
        data: {
          activeChats: { decrement: 1 },
          isAvailable: true
        }
      });

      // Mark all participants inactive
      await tx.chatParticipant.updateMany({
        where: { sessionId: request.sessionId },
        data: {
          isActive: false,
          leftAt: new Date()
        }
      });

      return updatedRequest;
    });

    Logger.info(`Support request ${request.requestNumber} resolved by ${staffId}`);
    return result;
  }

  /**
   * Cancel a support request (by user)
   */
  static async cancelRequest(
    requestId: string,
    userId: string
  ): Promise<any> {
    const request = await prisma.chatRequest.findUnique({
      where: { id: requestId },
      include: { session: true }
    });

    if (!request) {
      throw new NotFoundError("Support request not found");
    }

    if (request.userId !== userId) {
      throw new ForbiddenError("You can only cancel your own requests");
    }

    if (request.status === ChatRequestStatus.RESOLVED || request.status === ChatRequestStatus.CANCELLED) {
      throw new BadRequestError(`Cannot cancel a ${request.status.toLowerCase()} request`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update request
      const updatedRequest = await tx.chatRequest.update({
        where: { id: requestId },
        data: {
          status: ChatRequestStatus.CANCELLED,
          cancelledAt: new Date()
        }
      });

      // End session
      await tx.chatSession.update({
        where: { id: request.sessionId },
        data: {
          status: ChatSessionStatus.ENDED,
          endedAt: new Date(),
          endedBy: userId
        }
      });

      // If staff was assigned, free them up
      if (request.assignedStaffId) {
        await tx.staffStatus.updateMany({
          where: { staffId: request.assignedStaffId },
          data: {
            activeChats: { decrement: 1 },
            isAvailable: true
          }
        });
      }

      // Mark all participants inactive
      await tx.chatParticipant.updateMany({
        where: { sessionId: request.sessionId },
        data: {
          isActive: false,
          leftAt: new Date()
        }
      });

      return updatedRequest;
    });

    Logger.info(`Support request ${request.requestNumber} cancelled by user ${userId}`);
    return result;
  }

  /**
   * Get user's chat sessions
   */
  static async getUserChatSessions(
    userId: string,
    filters?: {
      type?: ChatType;
      status?: ChatSessionStatus;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const { type, status, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {
      participants: {
        some: {
          userId,
          isActive: true
        }
      }
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          participants: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  avatar: true,
                  role: true
                }
              }
            }
          },
          property: {
            select: { id: true, name: true, address: true }
          },
          request: {
            select: {
              id: true,
              requestNumber: true,
              status: true,
              priority: true,
              assignedStaffId: true
            }
          },
          _count: {
            select: {
              messages: {
                where: { isRead: false }
              }
            }
          }
        }
      }),
      prisma.chatSession.count({ where })
    ]);

    return {
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get chat session by ID
   */
  static async getChatSessionById(
    sessionId: string,
    userId: string,
    role: Role
  ): Promise<any> {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
                role: true
              }
            }
          }
        },
        property: {
          select: { id: true, name: true, address: true, city: true, state: true }
        },
        request: {
          include: {
            assignedStaff: {
              select: { id: true, fullName: true, email: true, avatar: true }
            }
          }
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, fullName: true, avatar: true, role: true }
            }
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundError("Chat session not found");
    }

    // Check if user is a participant or admin
    const isParticipant = session.participants.some(p => p.userId === userId && p.isActive);
    const isAdmin = role === Role.ADMIN;

    if (!isParticipant && !isAdmin) {
      throw new ForbiddenError("You don't have access to this chat session");
    }

    return session;
  }

  /**
   * Get pending support requests (for staff/admin)
   */
  static async getPendingRequests(
    filters?: {
      status?: ChatRequestStatus;
      priority?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const { status, priority, page = 1, limit = 20 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [requests, total, pendingCount, assignedCount] = await Promise.all([
      prisma.chatRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ],
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatar: true,
              role: true
            }
          },
          assignedStaff: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: true
            }
          },
          session: {
            select: {
              id: true,
              sessionNumber: true,
              agoraChannel: true,
              status: true
            }
          }
        }
      }),
      prisma.chatRequest.count({ where }),
      prisma.chatRequest.count({ where: { status: ChatRequestStatus.PENDING } }),
      prisma.chatRequest.count({ where: { status: ChatRequestStatus.ASSIGNED } })
    ]);

    return {
      requests,
      counts: {
        pending: pendingCount,
        assigned: assignedCount,
        total
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Set staff status (online/offline/available)
   */
  static async setStaffStatus(
    staffId: string,
    data: {
      isOnline?: boolean;
      isAvailable?: boolean;
      maxChats?: number;
      socketId?: string;
    }
  ): Promise<any> {
    const status = await prisma.staffStatus.upsert({
      where: { staffId },
      update: {
        ...data,
        lastSeen: new Date()
      },
      create: {
        staffId,
        isOnline: data.isOnline ?? true,
        isAvailable: data.isAvailable ?? true,
        maxChats: data.maxChats ?? 3,
        socketId: data.socketId,
        lastSeen: new Date()
      }
    });

    return status;
  }

  /**
   * Get available staff for assignment
   */
  static async getAvailableStaff(): Promise<any[]> {
    const staffList = await prisma.staffStatus.findMany({
      where: {
        isOnline: true,
        isAvailable: true
      },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            avatar: true,
            department: true,
            employeeId: true
          }
        }
      },
      orderBy: { activeChats: 'asc' }
    });

    // Filter out those who have reached max capacity
    return staffList.filter(s => s.activeChats < s.maxChats);
  }

  /**
   * Generate Agora token for a chat session
   */
  static async generateSessionToken(
    sessionId: string,
    userId: string
  ): Promise<any> {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: true
      }
    });

    if (!session) {
      throw new NotFoundError("Chat session not found");
    }

    // Verify user is a participant
    const isParticipant = session.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenError("You are not a participant in this chat");
    }

    // Generate Agora token
    const agoraUserId = `user_${userId}`;
    const token = AgoraService.generateChatToken(agoraUserId, 86400);

    // Also generate RTC token for voice/video calls
    const rtcToken = AgoraService.generateRTCToken(
      session.agoraChannel,
      agoraUserId,
      'publisher',
      3600
    );

    return {
      sessionId: session.id,
      agoraChannel: session.agoraChannel,
      agoraUserId,
      chatToken: token,
      rtcToken,
      expiresIn: 86400
    };
  }
}