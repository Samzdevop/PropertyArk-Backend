import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';


export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { page = 1, limit = 20, status } = req.query;

    const where: any = { recipientId: userId };
    if (status) where.status = String(status);

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { sentAt: 'desc' },
        include: {
          recipient: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          }
        }
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ 
        where: { ...where, status: 'UNREAD' } 
      })
    ]);

    sendSuccessResponse(res, 'Notifications retrieved successfully', {
      notifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

export const updateNotificationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const notificationId = req.params.notificationId;
    const { status } = req.body;

    const notification = await prisma.notification.update({
      where: { 
        id: notificationId,
        recipientId: userId // Ensure user can only update their own notifications
      },
      data: { 
        status,
        ...(status === 'READ' && { readAt: new Date() })
      }
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    sendSuccessResponse(res, 'Notification status updated successfully', { 
      notification 
    });
  } catch (error) {
    next(error);
  }
};