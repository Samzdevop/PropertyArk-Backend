"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationStatusSchema = exports.scheduleFollowUpSchema = exports.prescribeTreatmentSchema = exports.recordTreatmentSchema = void 0;
const zod_1 = require("zod");
exports.recordTreatmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        dateOfTreatment: zod_1.z.string().min(1, "Date of treatment is required"),
        treatmentType: zod_1.z.string().min(1, "Treatment type is required"),
        dosage: zod_1.z.number().min(0, "Dosage must be positive"),
        cause: zod_1.z.string().min(1, "Cause is required"),
        administeredBy: zod_1.z.string().min(1, "Administered by is required"),
        nextDueDate: zod_1.z.string().optional(),
    }),
});
exports.prescribeTreatmentSchema = zod_1.z.object({
    params: zod_1.z.object({
        livestockId: zod_1.z.string().min(1, "Livestock ID is required")
    }),
    body: zod_1.z.object({
        treatmentType: zod_1.z.string().min(1, "Treatment type is required"),
        medicationName: zod_1.z.string().min(1, "Medication name is required"),
        dosage: zod_1.z.string().min(1, "Dosage is required"),
        frequency: zod_1.z.enum(['DAILY', 'TWICE_DAILY', 'EVERY_OTHER_DAY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'AS_NEEDED']),
        routine: zod_1.z.enum(['ORAL', 'INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRAVENOUS', 'TOPICAL', 'INTRAMAMMARY']),
        additionalNotes: zod_1.z.string().optional(),
        startDate: zod_1.z.string().min(1, "Start date is required"),
        endDate: zod_1.z.string().optional()
    })
});
exports.scheduleFollowUpSchema = zod_1.z.object({
    body: zod_1.z.object({
        prescribedTreatmentId: zod_1.z.string().optional(),
        reason: zod_1.z.string().min(1, "Reason for follow-up is required"),
        date: zod_1.z.string().min(1, "Date is required"),
        time: zod_1.z.string().min(1, "Time is required"),
        relatedAnimalId: zod_1.z.string().min(1, "Related animal is required"),
        relatedFarm: zod_1.z.string().min(1, "Related farm is required"),
        location: zod_1.z.string().min(1, "Location is required"),
        additionalNotes: zod_1.z.string().optional(),
        setReminder: zod_1.z.boolean().default(false),
        notifyFarmStaff: zod_1.z.boolean().default(false)
    })
});
exports.updateNotificationStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['READ', 'DISMISSED'])
    })
});
