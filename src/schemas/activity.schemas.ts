import { z } from 'zod';

export const getAllActivitiesSchema = z.object({
  query: z.object({
    entityType: z.string().optional(),
    action: z.string().optional(),
    userId: z.string().cuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().optional().default('1').transform(val => parseInt(val)),
    limit: z.string().optional().default('20').transform(val => parseInt(val))
  })
});

export const getActivityByIdSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid activity ID format')
  })
});

export const getUserActivitiesSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID format')
  }),
  query: z.object({
    entityType: z.string().optional(),
    action: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().optional().default('1').transform(val => parseInt(val)),
    limit: z.string().optional().default('20').transform(val => parseInt(val))
  })
});

export const getEntityActivitiesSchema = z.object({
  params: z.object({
    entityType: z.enum([
      'PROPERTY', 'USER', 'DOCUMENT', 
      'NIN', 'PROPERTY_REVIEW', 'PAYMENT', 'NOTIFICATION'
    ]),
    entityId: z.string().cuid('Invalid entity ID format')
  }),
  query: z.object({
    page: z.string().optional().default('1').transform(val => parseInt(val)),
    limit: z.string().optional().default('20').transform(val => parseInt(val))
  })
});

export const activityStatsSchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }).optional()
});

export const cleanupActivitiesSchema = z.object({
  query: z.object({
    days: z.string().optional().default('90').transform(val => parseInt(val))
  })
});

export const vendorActivitySummarySchema = z.object({
  params: z.object({
    vendorId: z.string().cuid('Invalid vendor ID format')
  })
});