// src/schemas/appointment.schemas.ts
import { z } from 'zod';

export const scheduleAppointmentSchema = z.object({
  body: z.object({
    visitType: z.enum(['FARM_VISIT', 'MEETING']),
    title: z.string().min(1, "Title is required"),
    date: z.string().min(1, "Date is required"),
    time: z.string().min(1, "Time is required"),
    relatedFarm: z.string().min(1, "Related farm is required"),
    relatedAnimal: z.string().optional(),
    purpose: z.string().min(1, "Purpose is required"),
    setReminder: z.boolean().default(false),
    notifyFarmStaff: z.boolean().default(false)
  })
});

export const logFarmVisitSchema = z.object({
  body: z.object({
    relatedFarm: z.string().min(1, "Related farm is required"),
    date: z.string().min(1, "Date is required"),
    time: z.string().min(1, "Time is required"),
    reason: z.string().min(1, "Reason for visit is required"),
    keyPersonnelMet: z.string().min(1, "Key personnel met is required"),
    animalExamined: z.string().min(1, "Animal examined is required"),
    farmObservation: z.string().min(1, "Farm observation is required"),
    farmRecommendation: z.string().min(1, "Farm recommendation is required"),
    mediaUrls: z.array(z.string().url("Media URL must be a valid URL")).optional().default([])
  })
});