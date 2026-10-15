import { z } from 'zod';

const ContactStatusEnum = z.enum(['UNREAD', 'READ', 'REPLIED', 'ARCHIVED']);

export const createContactSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').max(100),
    email: z.string().email('Invalid email format'),
    subject: z.string().min(1, 'Subject is required').max(200),
    message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  }),
});

export const getContactsQuerySchema = z.object({
  query: z.object({
    status: ContactStatusEnum.optional(),
    search: z.string().optional(),
    page: z.string().optional().default('1').transform(v => parseInt(v)),
    limit: z.string().optional().default('20').transform(v => parseInt(v)),
  }),
});