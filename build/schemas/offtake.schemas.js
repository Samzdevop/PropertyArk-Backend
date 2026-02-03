"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOfftakeSchema = exports.offtakeSchema = void 0;
const zod_1 = require("zod");
const baseSchema = zod_1.z.object({
    type: zod_1.z.enum(['SALE', 'DEATH', 'MISSING']),
    dateOfEvent: zod_1.z.string().min(1, "Date is required"),
    notes: zod_1.z.string().optional(),
});
exports.offtakeSchema = zod_1.z.discriminatedUnion('type', [
    // Sale
    baseSchema.extend({
        type: zod_1.z.literal('SALE'),
        destination: zod_1.z.string().min(1, "Destination required"),
        price: zod_1.z.number().min(0, "Price must be positive"),
    }),
    // Death
    baseSchema.extend({
        type: zod_1.z.literal('DEATH'),
        causeOfDeath: zod_1.z.string().min(1, "Cause required"),
    }),
    // Missing
    baseSchema.extend({
        type: zod_1.z.literal('MISSING'),
    }),
]);
exports.createOfftakeSchema = zod_1.z.object({
    body: exports.offtakeSchema
});
