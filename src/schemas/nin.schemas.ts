import { z } from 'zod';

export const verifyNINSchema = z.object({
  params: z.object({
    vendorId: z.string().cuid('Invalid vendor ID')
  }),
  body: z.object({
    status: z.enum(['VERIFIED', 'REJECTED']),
    rejectionReason: z.string().optional()
  }).refine(
    (data) => {
      if (data.status === 'REJECTED' && !data.rejectionReason) {
        return false;
      }
      return true;
    },
    {
      message: "Rejection reason is required when rejecting NIN",
      path: ["rejectionReason"]
    }
  )
});
