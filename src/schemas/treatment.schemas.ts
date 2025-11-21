import { z } from "zod";

export const recordTreatmentSchema = z.object({
  body: z.object({
    dateOfTreatment: z.string().min(1, "Date of treatment is required"),
    treatmentType: z.string().min(1, "Treatment type is required"),
    dosage: z.number().min(0, "Dosage must be positive"),
    cause: z.string().min(1, "Cause is required"),
    administeredBy: z.string().min(1, "Administered by is required"),
    nextDueDate: z.string().optional(),
  }),
});


export const prescribeTreatmentSchema = z.object({
  params: z.object({
    livestockId: z.string().min(1, "Livestock ID is required")
  }),
  body: z.object({
    treatmentType: z.string().min(1, "Treatment type is required"),
    medicationName: z.string().min(1, "Medication name is required"),
    dosage: z.string().min(1, "Dosage is required"),
    frequency: z.enum(['DAILY', 'TWICE_DAILY', 'EVERY_OTHER_DAY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'AS_NEEDED']),
    routine: z.enum(['ORAL', 'INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRAVENOUS', 'TOPICAL', 'INTRAMAMMARY']),
    additionalNotes: z.string().optional(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().optional()
  })
});

export const scheduleFollowUpSchema = z.object({
  body: z.object({
    prescribedTreatmentId: z.string().optional(),
    reason: z.string().min(1, "Reason for follow-up is required"),
    date: z.string().min(1, "Date is required"),
    time: z.string().min(1, "Time is required"),
    relatedAnimalId: z.string().min(1, "Related animal is required"),
    relatedFarm: z.string().min(1, "Related farm is required"),
    location: z.string().min(1, "Location is required"),
    additionalNotes: z.string().optional(),
    setReminder: z.boolean().default(false),
    notifyFarmStaff: z.boolean().default(false)
  })
});

export const updateNotificationStatusSchema = z.object({
  body: z.object({
    status: z.enum(['READ', 'DISMISSED'])
  })
});