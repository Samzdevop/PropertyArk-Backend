import { z } from 'zod';

const baseInventorySchema = z.object({
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

export const inventoryRecordSchema = z.discriminatedUnion('recordType', [
  baseInventorySchema.extend({
    recordType: z.literal('NEW'),
    type: z.enum(['FEED', 'MEDICINE', 'EQUIPMENT']),
    name: z.string().min(1, "Item name is required"),
    quantity: z.coerce.number().min(0.1, "Quantity must be positive"),
    purchasePricePerUnit: z.coerce.number().min(0, "Price must be positive"),
    supplierName: z.string().min(1, "Supplier is required"),
     reorderPoint: z.coerce.number().min(1, "Reorder point must be at least 1")
  }),
  
  // ITEM (Restock)
  baseInventorySchema.extend({
    recordType: z.literal('ITEM'),
    itemToRestock: z.string().min(1, "Item ID is required"),
    quantityReceived: z.coerce.number().min(0.1, "Quantity must be positive"),
    purchasePricePerUnit: z.coerce.number().min(0, "Price must be positive"),
    supplierName: z.string().min(1, "Supplier is required")
  }),
  
  // USE Record
  baseInventorySchema.extend({
    recordType: z.literal('USE'),
    itemToUse: z.string().min(1, "Item ID is required"),
    quantityToUse: z.coerce.number().min(0.1, "Quantity must be positive"),
    movementType: z.string().min(1, "Movement type is required"),
    relatedAnimals: z.string().optional()
  })
]);

export const createInventoryRecordSchema = z.object({
  body: inventoryRecordSchema
});