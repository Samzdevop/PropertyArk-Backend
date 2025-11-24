import { z } from 'zod';

export const updateNotificationSettingsSchema = z.object({
  body: z.object({
    followUpReminders: z.boolean().optional(),
    upcomingAppointments: z.boolean().optional(),
    messageNotifications: z.boolean().optional()
  })
});