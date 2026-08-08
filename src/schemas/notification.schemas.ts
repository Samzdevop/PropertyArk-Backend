import { z } from "zod";


export const sendToUserSchema = z.object({
  body: z.object({
    userId: z.string().cuid("Invalid user ID"),
    title: z.string().min(1, "Title is required").max(100, "Title too long"),
    message: z.string().min(1, "Message is required").max(1000, "Message too long"),
    type: z.enum(['RENT_DUE', 'LEASE_EXPIRING', 'MAINTENANCE_UPDATE', 'PAYMENT_CONFIRMATION', 'REQUEST_STATUS', 'GENERAL']).optional(),
    channel: z.enum(['IN_APP', 'EMAIL', 'BOTH']).optional().default('IN_APP'),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
    data: z.any().optional()
  })
});

export const sendBulkSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").max(100, "Title too long"),
    message: z.string().min(1, "Message is required").max(1000, "Message too long"),
    type: z.enum(['RENT_DUE', 'LEASE_EXPIRING', 'MAINTENANCE_UPDATE', 'PAYMENT_CONFIRMATION', 'REQUEST_STATUS', 'GENERAL']).optional(),
    channel: z.enum(['IN_APP', 'EMAIL', 'BOTH']).optional().default('IN_APP'),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
    target: z.enum(['ALL', 'VENDOR', 'USER', 'STAFF', 'SPECIFIC']),
    userIds: z.array(z.string().cuid()).optional(),
    roles: z.array(z.enum(['VENDOR', 'USER', 'STAFF'])).optional(),
    data: z.any().optional()
  }).refine(
    (data) => {
      if (data.target === 'SPECIFIC' && (!data.userIds || data.userIds.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "User IDs are required when target is SPECIFIC",
      path: ["userIds"]
    }
  )
});

export const markAsReadSchema = z.object({
  params: z.object({
    notificationId: z.string().cuid("Invalid notification ID")
  })
});

export const deleteNotificationSchema = z.object({
  params: z.object({
    notificationId: z.string().cuid("Invalid notification ID")
  })
});

export const getNotificationsSchema = z.object({
  query: z.object({
    read: z.enum(['true', 'false']).optional(),
    type: z.enum(['RENT_DUE', 'LEASE_EXPIRING', 'MAINTENANCE_UPDATE', 'PAYMENT_CONFIRMATION', 'REQUEST_STATUS', 'GENERAL']).optional(),
    channel: z.enum(['IN_APP', 'EMAIL', 'BOTH']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    page: z.string().optional().default('1').transform(val => parseInt(val)),
    limit: z.string().optional().default('20').transform(val => parseInt(val))
  })
});

export const getBulkDetailsSchema = z.object({
  params: z.object({
    bulkId: z.string().min(1, "Bulk ID is required")
  })
});