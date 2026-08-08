import { z } from "zod";

export const propertyManagementStatsSchema = z.object({
  query: z.object({
    page: z.string().optional().default('1').transform(val => parseInt(val)),
    limit: z.string().optional().default('20').transform(val => parseInt(val)),
    status: z.enum(['PENDING', 'ACTIVE', 'REJECTED']).optional(),
    listingType: z.enum(['FOR_RENT', 'FOR_SALE', 'FOR_LAND', 'FOR_SHORTLET']).optional(),
    search: z.string().optional()
  })
});
