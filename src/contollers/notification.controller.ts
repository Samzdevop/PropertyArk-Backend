import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { BadRequestError } from '../errors/BadRequestError';
import { NotificationService } from '../services/notification.services';
import { NotificationType, NotificationStatus } from '@prisma/client';
import { LivestockNotificationHelpers } from '../helpers/notification.helpers';

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
): Promise<void> =>{
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



export const getNotificationSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any).id;

    let settings = await prisma.notificationSettings.findUnique({
      where: { userId }
    });

    // If settings don't exist, create default ones
    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: {
          userId,
          followUpReminders: true,
          upcomingAppointments: true,
          messageNotifications: true
        }
      });
    }

    sendSuccessResponse(res, 'Notification settings retrieved successfully', { settings });
  } catch (error) {
    next(error);
  }
};

export const updateNotificationSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> =>{
  try {
    const userId = (req.user as any).id;
    const { followUpReminders, upcomingAppointments, messageNotifications } = req.body;

    // Check if settings exist
    const existingSettings = await prisma.notificationSettings.findUnique({
      where: { userId }
    });

    let settings;

    if (existingSettings) {
      // Update existing settings
      settings = await prisma.notificationSettings.update({
        where: { userId },
        data: {
          ...(followUpReminders !== undefined && { followUpReminders }),
          ...(upcomingAppointments !== undefined && { upcomingAppointments }),
          ...(messageNotifications !== undefined && { messageNotifications })
        }
      });
    } else {
      // Create new settings with provided values or defaults
      settings = await prisma.notificationSettings.create({
        data: {
          userId,
          followUpReminders: followUpReminders !== undefined ? followUpReminders : true,
          upcomingAppointments: upcomingAppointments !== undefined ? upcomingAppointments : true,
          messageNotifications: messageNotifications !== undefined ? messageNotifications : true
        }
      });
    }

    sendSuccessResponse(res, 'Notification settings updated successfully', { settings });
  } catch (error) {
    next(error);
  }
};

export const toggleNotificationSetting = async (
  req: Request,
  res: Response,
  next: NextFunction
) : Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const { settingType } = req.params;
    const { enabled } = req.body;

    const validSettings = ['followUpReminders', 'upcomingAppointments', 'messageNotifications'];
    
     if (!validSettings.includes(settingType)) {
      throw new BadRequestError('Invalid setting type. Must be one of: followUpReminders, upcomingAppointments, messageNotifications');
    }


    // Check if settings exist
    let settings = await prisma.notificationSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      // Create default settings first
      settings = await prisma.notificationSettings.create({
        data: {
          userId,
          followUpReminders: true,
          upcomingAppointments: true,
          messageNotifications: true
        }
      });
    }

    // Update the specific setting
    const updateData: any = {};
    updateData[settingType] = enabled;

    settings = await prisma.notificationSettings.update({
      where: { userId },
      data: updateData
    });

    sendSuccessResponse(res, `${settingType} ${enabled ? 'enabled' : 'disabled'} successfully`, { 
      setting: settingType,
      enabled,
      settings 
    });
  } catch (error) {
    next(error);
  }
};

// Simplified controller using the helper
export const requestWeightUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const { livestockId } = req.params;
    const { additionalNotes } = req.body;

    const result = await LivestockNotificationHelpers.createLivestockUpdateRequest(
      livestockId,
      'WEIGHT_UPDATE',
      {
        id: userId,
        fullName: (req.user as any).fullName,
        role: userRole
      },
      additionalNotes
    );

    sendSuccessResponse(
      res,
      `Weight update request sent to ${result.notifications.length} farmkeeper(s)`,
      {
        livestock: result.livestock,
        company: result.company,
        notificationsSent: result.notifications.length,
        skippedCount: result.skippedCount
      },
      201
    );
  } catch (error) {
    next(error);
  }
};


export const requestHealthStatusUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const { livestockId } = req.params;
    const { additionalNotes } = req.body;

    const result = await LivestockNotificationHelpers.createLivestockUpdateRequest(
      livestockId,
      'HEALTH_STATUS_UPDATE',
      {
        id: userId,
        fullName: (req.user as any).fullName,
        role: userRole
      },
      additionalNotes
    );

    sendSuccessResponse(
      res,
      `Health status update request sent to ${result.notifications.length} farmkeeper(s)`,
      201
    );
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('No farmkeeper')) {
      return next(new NotFoundError(error.message));
    }
    next(error);
  }
};

// export const requestCombinedUpdate = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = (req.user as any).id;
//     const userRole = (req.user as any).role;
//     const { livestockId } = req.params;
//     const { additionalNotes } = req.body;

//     const result = await LivestockNotificationHelpers.createLivestockUpdateRequest(
//       livestockId,
//       'COMBINED_UPDATE',
//       {
//         id: userId,
//         fullName: (req.user as any).fullName,
//         role: userRole
//       },
//       additionalNotes
//     );

//     sendSuccessResponse(
//       res,
//       `Weight and health status update request sent to ${result.notifications.length} farmkeeper(s)`,
//       201
//     );
//   } catch (error: any) {
//     if (error.message.includes('not found') || error.message.includes('No farmkeeper')) {
//       return next(new NotFoundError(error.message));
//     }
//     next(error);
//   }
// };