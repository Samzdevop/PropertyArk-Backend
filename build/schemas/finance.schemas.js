"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financialTransactionSchema = void 0;
const zod_1 = require("zod");
exports.financialTransactionSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum(['INCOME', 'EXPENSE']),
        referenceNumber: zod_1.z.string().min(1, "Reference number is required"),
        title: zod_1.z.string().min(1, "Title is required"),
        amount: zod_1.z.string()
            .min(1, "Amount is required")
            .refine(val => !isNaN(parseFloat(val)), "Amount must be a number"),
        paymentMethod: zod_1.z.string().min(1, "Payment method is required"),
        date: zod_1.z.string().min(1, "Date is required"),
        description: zod_1.z.string().optional(),
        partyName: zod_1.z.string().min(1, "Party name is required (buyer/vendor)")
    })
});
