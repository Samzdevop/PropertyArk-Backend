import { z } from 'zod';


const isValidDateString = (val: string): boolean => {
  if (!val) return false;
  
  const isoDate = new Date(val);
  if (!isNaN(isoDate.getTime())) {
    return true;
  }
  
  const simpleDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (simpleDateRegex.test(val)) {
    const parts = val.split('-').map(Number);
    const testDate = new Date(parts[0], parts[1] - 1, parts[2]);
    return !isNaN(testDate.getTime());
  }
  
  return false;
};


export const createInquirySchema = z.object({
  body: z.object({
    propertyId: z.string().cuid('Invalid property ID'),
    name: z.string().min(1, 'Name is required'),
    location: z.string().min(1, 'Location is required'),
    message: z.string().min(1, 'Message is required'),
    meetingType: z.enum(['VIDEO_CALL', 'IN_PERSON'], {
      errorMap: () => ({ message: "Meeting type must be 'VIDEO_CALL' or 'IN_PERSON'" })
    }),
    proposedDate: z.string().refine(
      (val) => isValidDateString(val),
      { message: "Invalid proposed date. Use YYYY-MM-DD or ISO format" }
    ).optional()
  })
});

export const reviewInquirySchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid inquiry ID')
  }),
  body: z.object({
    status: z.enum(['ACCEPTED', 'DECLINED']),
    reason: z.string().optional(),
    scheduledDate: z.string().refine(
      (val) => isValidDateString(val),
      { message: "Invalid scheduled date. Use YYYY-MM-DD or ISO format (2026-09-24T14:00:00.000Z)" }
    ).optional()
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
  ).refine(
    (data) => {
      if (data.status === 'ACCEPTED' && !data.scheduledDate) {
        return false;
      }
      return true;
    },
    {
      message: "Scheduled date is required when accepting an inquiry",
      path: ["scheduledDate"]
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