import { z } from 'zod';

export const createDiagnosisSchema = z.object({
  params: z.object({
    livestockId: z.string().min(1, "Livestock ID is required")
  }),
  body: z.object({
    diagnosis: z.string().min(1, "Diagnosis is required"),
    labTests: z.string().optional().default(""),
    severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL', 'CHRONIC']).default('MILD'),
    prognosis: z.enum(['GOOD', 'FAIR', 'GUARDED', 'POOR']).default('GOOD'),
    observations: z.string().optional().default(""),
    date: z.string().min(1, "Date is required")
  })
});

export const updateDiagnosisSchema = z.object({
  params: z.object({
    diagnosisId: z.string().min(1, "Diagnosis ID is required")
  }),
  body: z.object({
    diagnosis: z.string().min(1, "Diagnosis is required").optional(),
    labTests: z.string().optional(),
    severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL', 'CHRONIC']).optional(),
    prognosis: z.enum(['GOOD', 'FAIR', 'GUARDED', 'POOR']).optional(),
    observations: z.string().optional(),
    date: z.string().min(1, "Date is required").optional()
  })
});
