import prisma from '../prisma';
import {  MessageType } from '@prisma/client';
import { BadRequestError } from '../errors/BadRequestError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';

export class MessageService {
  static async createMessage(data: any, senderId: string) {
    const {
      conversationId,
      content,
      messageType = 'TEXT',
      mediaUrl,
      fileName,
      fileSize,
      messageId,
      encryptedKey,
      parentMessageId
    } = data;

    // Verify conversation and permissions
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { userId: senderId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      throw new ForbiddenError('Not authorized to send message in this conversation');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        messageType: messageType as MessageType,
        mediaUrl,
        fileName,
        fileSize,
        // messageId,
        encryptedKey,
        parentMessageId,
        status: 'SENT'
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
            role: true
          }
        },
        parentMessage: {
          select: {
            id: true,
            content: true,
            sender: {
              select: {
                id: true,
                fullName: true
              }
            }
          }
        }
      }
    });

    // Update conversation last message
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: message.id,
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create deliveries for recipients
    const recipients = conversation.participants
      .filter(p => p.userId !== senderId)
      .map(p => p.user);

    await Promise.all(
      recipients.map(recipient =>
        prisma.messageDelivery.create({
          data: {
            messageId: message.id,
            recipientId: recipient.id,
            status: 'SENT'
          }
        })
      )
    );

    return {
      ...message,
      recipients
    };
  }

  static async markMessagesAsRead(messageIds: string[], userId: string) {
    // Update message deliveries
    await prisma.messageDelivery.updateMany({
      where: {
        messageId: { in: messageIds },
        recipientId: userId
      },
      data: {
        status: 'READ',
        readAt: new Date()
      }
    });

    // Update messages
    await prisma.message.updateMany({
      where: {
        id: { in: messageIds }
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  static async deleteMessage(messageId: string, userId: string, deleteForEveryone: boolean) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (!message.conversation.participants.some(p => p.userId === userId)) {
      throw new ForbiddenError('Not authorized to delete this message');
    }

    if (deleteForEveryone && message.senderId !== userId) {
      throw new ForbiddenError('Only sender can delete message for everyone');
    }

    if (deleteForEveryone) {
      // Delete for everyone
      await prisma.message.delete({
        where: { id: messageId }
      });

      return {
        deletedForEveryone: true,
        conversationId: message.conversationId
      };
    } else {
      // Delete for me only
      await prisma.message.update({
        where: { id: messageId },
        data: {
          deletedForUsers: {
            connect: { id: userId }
          }
        }
      });

      return {
        deletedForEveryone: false,
        conversationId: message.conversationId
      };
    }
  }

  static async addReaction(messageId: string, userId: string, emoji: string) {
    // Check if reaction exists
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId
        }
      }
    });

    if (existingReaction) {
      // Update existing reaction
      return await prisma.reaction.update({
        where: { id: existingReaction.id },
        data: { emoji },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });
    } else {
      // Create new reaction
      return await prisma.reaction.create({
        data: {
          messageId,
          userId,
          emoji
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });
    }
  }

  static async editMessage(messageId: string, userId: string, newContent: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenError('Only sender can edit message');
    }

    return await prisma.message.update({
      where: { id: messageId },
      data: {
        content: newContent,
        updatedAt: new Date()
      }
    });
  }

  static async startCall(conversationId: string, initiatorId: string, callType: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { userId: initiatorId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      throw new ForbiddenError('Not authorized to start call in this conversation');
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return await prisma.call.create({
      data: {
        callId,
        conversationId,
        initiatorId,
        callType,
        status: 'RINGING',
        participants: {
          create: conversation.participants
            .filter(p => p.userId !== initiatorId)
            .map(p => ({
              userId: p.userId,
              status: 'RINGING'
            }))
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true
              }
            }
          }
        }
      }
    });
  }

  static async endCall(callId: string, userId: string, reason: string) {
    const call = await prisma.call.findUnique({
      where: { callId },
      include: {
        conversation: {
          include: {
            participants: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    // Update call status
    const endedCall = await prisma.call.update({
      where: { callId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        endReason: reason,
        duration: Math.floor((new Date().getTime() - call.startedAt.getTime()) / 1000)
      },
      include: {
        conversation: {
          include: {
            participants: {
              select: { userId: true }
            }
          }
        }
      }
    });

    // Update participant status
    await prisma.callParticipant.updateMany({
      where: { callId },
      data: {
        status: 'ENDED',
        leftAt: new Date()
      }
    });

    return endedCall;
  }

  static async answerCall(callId: string, userId: string, accept: boolean) {
    const call = await prisma.call.findUnique({
      where: { callId },
      include: {
        initiator: {
          select: { id: true }
        }
      }
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }
    // Update participant status
    await prisma.callParticipant.update({
      where: {
        callId_userId: {
          callId,
          userId
        }
      },
      data: {
        status: accept ? 'JOINED' : 'DECLINED',
        joinedAt: accept ? new Date() : null
      }
    });
    if (accept) {
      // Update call status if participants joined
      const joinedCount = await prisma.callParticipant.count({
        where: {
          callId,
          status: 'JOINED'
        }
      });

      if (joinedCount > 0) {
        await prisma.call.update({
          where: { callId },
          data: { status: 'ACTIVE' }
        });
      }
    }

    return {
      accepted: accept,
      call
    };
  }
}