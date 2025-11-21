"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInventoryRecordSchema = exports.inventoryRecordSchema = void 0;
const zod_1 = require("zod");
const baseInventorySchema = zod_1.z.object({
    date: zod_1.z.string().min(1, "Date is required"),
    notes: zod_1.z.string().optional(),
});
exports.inventoryRecordSchema = zod_1.z.discriminatedUnion('recordType', [
    // NEW Record
    baseInventorySchema.extend({
        recordType: zod_1.z.literal('NEW'),
        type: zod_1.z.enum(['FEED', 'MEDICINE', 'EQUIPMENT']),
        name: zod_1.z.string().min(1, "Item name is required"),
        quantity: zod_1.z.coerce.number().min(0.1, "Quantity must be positive"),
        purchasePricePerUnit: zod_1.z.coerce.number().min(0, "Price must be positive"),
        supplierName: zod_1.z.string().min(1, "Supplier is required"),
        reorderPoint: zod_1.z.coerce.number().min(1, "Reorder point must be at least 1")
    }),
    // ITEM (Restock)
    baseInventorySchema.extend({
        recordType: zod_1.z.literal('ITEM'),
        itemToRestock: zod_1.z.string().min(1, "Item ID is required"),
        quantityReceived: zod_1.z.coerce.number().min(0.1, "Quantity must be positive"),
        purchasePricePerUnit: zod_1.z.coerce.number().min(0, "Price must be positive"),
        supplierName: zod_1.z.string().min(1, "Supplier is required")
    }),
    // USE Record
    baseInventorySchema.extend({
        recordType: zod_1.z.literal('USE'),
        itemToUse: zod_1.z.string().min(1, "Item ID is required"),
        quantityToUse: zod_1.z.coerce.number().min(0.1, "Quantity must be positive"),
        movementType: zod_1.z.string().min(1, "Movement type is required"),
        relatedAnimals: zod_1.z.string().optional()
    })
]);
exports.createInventoryRecordSchema = zod_1.z.object({
    body: exports.inventoryRecordSchema
});
