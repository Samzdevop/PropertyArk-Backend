// schemas/inquiry.schemas.ts
import { z } from 'zod';

export const createInquirySchema = z.object({
  body: z.object({
    propertyId: z.string().cuid('Invalid property ID'),
    name: z.string().min(1, 'Name is required'),
    location: z.string().min(1, 'Location is required'),
    message: z.string().min(1, 'Message is required'),
    meetingType: z.enum(['VIDEO_CALL', 'IN_PERSON'], {
      errorMap: () => ({ message: "Meeting type must be 'VIDEO_CALL' or 'IN_PERSON'" })
    })
  })
});

export const reviewInquirySchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid inquiry ID')
  }),
  body: z.object({
    status: z.enum(['ACCEPTED', 'DECLINED']),
    reason: z.string().optional()
  }).refine(
    (data) => {
      if (data.status === 'DECLINED' && !data.reason) {
        return false;
      }
      return true;
    },
    {
      message: "Reason is required when declining an inquiry",
      path: ["reason"]
    }
  )
});

export const getInquiriesQuerySchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED']).optional(),
    propertyId: z.string().cuid().optional(),
    page: z.string().optional().default('1').transform(val => parseInt(val)),
    limit: z.string().optional().default('20').transform(val => parseInt(val))
  })
});