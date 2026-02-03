import { z } from 'zod';

const baseSchema = z.object({
  type: z.enum(['SALE', 'DEATH', 'MISSING']),
  dateOfEvent: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

export const offtakeSchema = z.discriminatedUnion('type', [
  // Sale
  baseSchema.extend({
    type: z.literal('SALE'),
    destination: z.string().min(1, "Destination required"),
    price: z.number().min(0, "Price must be positive"),
  }),
  // Death
  baseSchema.extend({
    type: z.literal('DEATH'),
    causeOfDeath: z.string().min(1, "Cause required"),
  }),
  // Missing
  baseSchema.extend({
    type: z.literal('MISSING'),
  }),
]);

export const createOfftakeSchema = z.object({
  body: offtakeSchema
});