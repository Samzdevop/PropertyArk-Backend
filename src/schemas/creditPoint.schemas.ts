import { z } from "zod";


export const updateSettingsSchema = z.object({
  body: z.object({
    newVendorBonusPoints: z.number().min(0).optional(),
    newVendorBonusExpiryDays: z.number().min(1).optional(),
    propertyCreationCost: z.number().min(0).optional(),
    featurePropertyCost: z.number().min(0).optional(),
    featurePropertyDurationDays: z.number().min(1).optional(),
    minimumPurchasePoints: z.number().min(1).optional(),
    pricePerPoint: z.number().positive().optional(),
    currency: z.string().optional()
  })
});


export const initializePurchaseSchema = z.object({
  body: z.object({
    points: z.number().min(1, "Points must be at least 1")
  })
});


export const calculatePurchaseSchema = z.object({
  query: z.object({
    points: z.string().transform(val => parseInt(val))
  })
});

export const adminGiftCreditPointsSchema = z.object({
  body: z.object({
    vendorIds: z
      .array(z.string().cuid('Invalid vendor ID'))
      .optional(),
    points: z
      .number({ invalid_type_error: 'Points must be a number' })
      .int('Points must be a whole number')
      .positive('Points must be greater than 0'),
    name: z
      .string()
      .min(1, 'Credit grant name is required')
      .max(200, 'Name too long'),
    expiresAt: z.string().datetime().optional(),
    reason: z.string().max(500).optional()
  })
});
