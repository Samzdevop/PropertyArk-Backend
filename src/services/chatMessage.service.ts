// services/chatMessage.service.ts
import prisma from "../prisma";
import { ChatParticipantRole, Role } from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import Logger from "../config/logger";
import { NotificationService } from "./notification.service";
import { EncryptionService } from "./encryption.service";

export class ChatMessageService {

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
   * Save a message with encryption
   */
  static async saveMessage(
    sessionId: string,
    senderId: string,
    content: string,
    messageType: string = 'text',
    agoraMsgId?: string,
    metadata?: any
  ): Promise<any> {
    // Verify session and sender
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, fullName: true, email: true }
            }
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundError("Chat session not found");
    }

    if (session.status !== 'ACTIVE') {
      throw new BadRequestError("Cannot send messages to an inactive chat session");
    }

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, role: true, fullName: true }
    });

    if (!sender) {
      throw new NotFoundError("Sender not found");
    }

    const isParticipant = session.participants.some(p => p.userId === senderId);
    if (!isParticipant) {
      throw new ForbiddenError("You are not a participant in this chat");
    }

    // ✅ Encrypt the content
    const encryptedContent = await EncryptionService.encrypt(content);
    const contentHash = EncryptionService.generateSearchHash(content);

    // ✅ Encrypt metadata if provided
    let encryptedMetadata: any = null;
    if (metadata) {
      const metadataEncrypted = await EncryptionService.encryptMetadata(metadata);
      encryptedMetadata = metadataEncrypted;
    }

    // Create message with encryption
    const message = await prisma.chatMessage.create({
      data: {
        sessionId,
        senderId,
        senderRole: this.getRoleString(sender.role),
        
        // ✅ Encrypted content
        content: encryptedContent.ciphertext,
        iv: encryptedContent.iv,
        authTag: encryptedContent.authTag,
        encryptedKey: encryptedContent.keyId,
        
        // ✅ Encrypted metadata
        metadata: encryptedMetadata?.ciphertext || null,
        metadataIv: encryptedMetadata?.iv || null,
        metadataAuthTag: encryptedMetadata?.authTag || null,
        
        // Search hash for exact matches
        contentHash,
        
        messageType,
        agoraMsgId
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
            role: true
          }
        }
      }
    });

    // Update session
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        lastMessage: content.length > 100 ? content.substring(0, 100) + '...' : content,
        lastMessageAt: new Date()
      }
    });

    // Notify other participants
    const otherParticipants = session.participants.filter(p => p.userId !== senderId);
    
    for (const participant of otherParticipants) {
      try {
        await NotificationService.sendToUser(
          participant.userId,
          {
            title: `New message from ${sender.fullName}`,
            message: content.length > 50 ? content.substring(0, 50) + '...' : content,
            type: 'GENERAL' as any,
            channel: 'IN_APP' as any,
            priority: 'NORMAL' as any,
            data: {
              sessionId,
              messageId: message.id,
              senderId,
              type: 'chat_message'
            }
          }
        );
      } catch (error) {
        Logger.error(`Failed to notify participant ${participant.userId}:`, error);
      }
    }

    // ✅ Return decrypted message
    return {
      ...message,
      content, // Return decrypted
      metadata: metadata || null,
      // Don't expose encryption details to client
      iv: undefined,
      authTag: undefined,
      encryptedKey: undefined,
      metadataIv: undefined,
      metadataAuthTag: undefined,
      contentHash: undefined
    };
  }

  /**
   * Get messages with decryption
   */
  static async getSessionMessages(
    sessionId: string,
    userId: string,
    role: Role,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: true
      }
    });

    if (!session) {
      throw new NotFoundError("Chat session not found");
    }

    const isParticipant = session.participants.some(p => p.userId === userId);
    const isAdmin = role === Role.ADMIN;

    if (!isParticipant && !isAdmin) {
      throw new ForbiddenError("You don't have access to this chat session");
    }

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { 
          sessionId,
          isDeleted: false
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatar: true,
              role: true
            }
          }
        }
      }),
      prisma.chatMessage.count({ 
        where: { 
          sessionId,
          isDeleted: false
        } 
      })
    ]);

    // ✅ Decrypt all messages
    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const content = await EncryptionService.decrypt({
            ciphertext: msg.content,
            iv: msg.iv,
            authTag: msg.authTag,
            keyId: msg.encryptedKey!
          });

          let metadata = null;
          if (msg.metadata && msg.metadataIv && msg.metadataAuthTag) {
            metadata = await EncryptionService.decryptMetadata({
              ciphertext: msg.metadata,
              iv: msg.metadataIv,
              authTag: msg.metadataAuthTag,
              keyId: msg.encryptedKey!
            });
          }

          return {
            id: msg.id,
            sessionId: msg.sessionId,
            senderId: msg.senderId,
            senderRole: msg.senderRole,
            content, // ✅ Decrypted
            messageType: msg.messageType,
            metadata, // ✅ Decrypted
            isRead: msg.isRead,
            readAt: msg.readAt,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
            sender: msg.sender
          };
        } catch (error: any) {
          Logger.error(`Failed to decrypt message ${msg.id}:`, error);
          return {
            id: msg.id,
            sessionId: msg.sessionId,
            senderId: msg.senderId,
            senderRole: msg.senderRole,
            content: '[Unable to decrypt message]',
            messageType: msg.messageType,
            metadata: null,
            isRead: msg.isRead,
            readAt: msg.readAt,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
            sender: msg.sender,
            decryptionError: true
          };
        }
      })
    );

    // Mark messages as read
    if (isParticipant) {
      await prisma.chatMessage.updateMany({
        where: {
          sessionId,
          senderId: { not: userId },
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
    }

    return {
      messages: decryptedMessages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Search messages by exact content match (using hash)
   */
  static async searchMessages(
    sessionId: string,
    userId: string,
    searchTerm: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;

    // Verify access
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { participants: true }
    });

    if (!session) {
      throw new NotFoundError("Chat session not found");
    }

    const isParticipant = session.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenError("You don't have access to this chat session");
    }

    // ✅ Search using hash (exact match only, no decryption needed)
    const searchHash = EncryptionService.generateSearchHash(searchTerm);

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: {
          sessionId,
          contentHash: searchHash,
          isDeleted: false
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatar: true,
              role: true
            }
          }
        }
      }),
      prisma.chatMessage.count({
        where: {
          sessionId,
          contentHash: searchHash,
          isDeleted: false
        }
      })
    ]);

    // Decrypt results
    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const content = await EncryptionService.decrypt({
            ciphertext: msg.content,
            iv: msg.iv,
            authTag: msg.authTag,
            keyId: msg.encryptedKey!
          });

          return {
            id: msg.id,
            content,
            sender: msg.sender,
            createdAt: msg.createdAt
          };
        } catch (error) {
          return {
            id: msg.id,
            content: '[Unable to decrypt]',
            sender: msg.sender,
            createdAt: msg.createdAt
          };
        }
      })
    );

    return {
      messages: decryptedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Soft delete a message
   */
  static async deleteMessage(
    messageId: string,
    userId: string,
    role: Role
  ): Promise<any> {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    // Only sender or admin can delete
    const canDelete = message.senderId === userId || role === Role.ADMIN;
    if (!canDelete) {
      throw new ForbiddenError("You don't have permission to delete this message");
    }

    // Soft delete
    const updatedMessage = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        // Overwrite content with empty encrypted string for privacy
        content: '',
        metadata: null
      }
    });

    return updatedMessage;
  }

  /**
   * Mark messages as read
   */
  static async markMessagesAsRead(
    sessionId: string,
    userId: string
  ): Promise<any> {
    const result = await prisma.chatMessage.updateMany({
      where: {
        sessionId,
        senderId: { not: userId },
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return { count: result.count };
  }

  /**
   * Get unread message count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const count = await prisma.chatMessage.count({
      where: {
        session: {
          participants: {
            some: {
              userId,
              isActive: true
            }
          }
        },
        senderId: { not: userId },
        isRead: false,
        isDeleted: false
      }
    });

    return count;
  }
}