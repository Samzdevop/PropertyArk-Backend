"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGiftCreditPointsSchema = exports.calculatePurchaseSchema = exports.initializePurchaseSchema = exports.updateSettingsSchema = void 0;
const zod_1 = require("zod");
exports.updateSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        newVendorBonusPoints: zod_1.z.number().min(0).optional(),
        newVendorBonusExpiryDays: zod_1.z.number().min(1).optional(),
        propertyCreationCost: zod_1.z.number().min(0).optional(),
        featurePropertyCost: zod_1.z.number().min(0).optional(),
        featurePropertyDurationDays: zod_1.z.number().min(1).optional(),
        minimumPurchasePoints: zod_1.z.number().min(1).optional(),
        pricePerPoint: zod_1.z.number().positive().optional(),
        currency: zod_1.z.string().optional()
    })
});
exports.initializePurchaseSchema = zod_1.z.object({
    body: zod_1.z.object({
        points: zod_1.z.number().min(1, "Points must be at least 1")
    })
});
exports.calculatePurchaseSchema = zod_1.z.object({
    query: zod_1.z.object({
        points: zod_1.z.string().transform(val => parseInt(val))
    })
});
exports.adminGiftCreditPointsSchema = zod_1.z.object({
    body: zod_1.z.object({
        vendorIds: zod_1.z
            .array(zod_1.z.string().cuid('Invalid vendor ID'))
            .optional(),
        points: zod_1.z
            .number({ invalid_type_error: 'Points must be a number' })
            .int('Points must be a whole number')
            .positive('Points must be greater than 0'),
        name: zod_1.z
            .string()
            .min(1, 'Credit grant name is required')
            .max(200, 'Name too long'),
        expiresAt: zod_1.z.string().datetime().optional(),
        reason: zod_1.z.string().max(500).optional()
    })
});
