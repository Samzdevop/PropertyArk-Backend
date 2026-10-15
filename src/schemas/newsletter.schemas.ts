  import { z } from 'zod';

export const subscribeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email format'),
  }),
});

export const unsubscribeByEmailSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    reason: z.string().max(500).optional(),
  }),
});

export const getSubscribersQuerySchema = z.object({
  query: z.object({
    isSubscribed: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
    page: z.string().optional().default('1').transform(v => parseInt(v)),
    limit: z.string().optional().default('20').transform(v => parseInt(v)),
  }),
});