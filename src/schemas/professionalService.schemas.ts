import { z } from 'zod';

const ServiceTypeEnum = z.enum([
  'ACCOUNTANT',
  'LEGAL',
  'MORTAGE_BROKER',
  'INSURANCE',
  'PROPERTY_DEVELOPER',
]);

const ContactStatusEnum = z.enum(['UNREAD', 'READ', 'REPLIED', 'ARCHIVED']);

const isValidDateString = (val: string): boolean => {
  if (!val) return false;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return true;
  return false;
};

export const createProfessionalServiceSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').max(100),
    email: z.string().email('Invalid email format'),
    phone: z.string().optional(),
    serviceType: ServiceTypeEnum,
    consultationDate: z.string().refine(isValidDateString, {
      message: 'Invalid date. Use YYYY-MM-DD or ISO format',
    }),
    propertyReference: z.string().optional(),
    message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  }),
});

export const getProfessionalServicesQuerySchema = z.object({
  query: z.object({
    status: ContactStatusEnum.optional(),
    serviceType: ServiceTypeEnum.optional(),
    search: z.string().optional(),
    page: z.string().optional().default('1').transform(v => parseInt(v)),
    limit: z.string().optional().default('20').transform(v => parseInt(v)),
  }),
});