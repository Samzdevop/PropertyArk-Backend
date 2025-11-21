"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDiagnosisSchema = exports.createDiagnosisSchema = void 0;
const zod_1 = require("zod");
exports.createDiagnosisSchema = zod_1.z.object({
    params: zod_1.z.object({
        livestockId: zod_1.z.string().min(1, "Livestock ID is required")
    }),
    body: zod_1.z.object({
        diagnosis: zod_1.z.string().min(1, "Diagnosis is required"),
        labTests: zod_1.z.string().optional().default(""),
        severity: zod_1.z.enum(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL', 'CHRONIC']).default('MILD'),
        prognosis: zod_1.z.enum(['GOOD', 'FAIR', 'GUARDED', 'POOR']).default('GOOD'),
        observations: zod_1.z.string().optional().default(""),
        date: zod_1.z.string().min(1, "Date is required")
    })
});
exports.updateDiagnosisSchema = zod_1.z.object({
    params: zod_1.z.object({
        diagnosisId: zod_1.z.string().min(1, "Diagnosis ID is required")
    }),
    body: zod_1.z.object({
        diagnosis: zod_1.z.string().min(1, "Diagnosis is required").optional(),
        labTests: zod_1.z.string().optional(),
        severity: zod_1.z.enum(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL', 'CHRONIC']).optional(),
        prognosis: zod_1.z.enum(['GOOD', 'FAIR', 'GUARDED', 'POOR']).optional(),
        observations: zod_1.z.string().optional(),
        date: zod_1.z.string().min(1, "Date is required").optional()
    })
});
