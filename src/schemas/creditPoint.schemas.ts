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
