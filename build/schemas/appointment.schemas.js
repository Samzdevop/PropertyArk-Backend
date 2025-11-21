"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logFarmVisitSchema = exports.scheduleAppointmentSchema = void 0;
// src/schemas/appointment.schemas.ts
const zod_1 = require("zod");
exports.scheduleAppointmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        visitType: zod_1.z.enum(['FARM_VISIT', 'MEETING']),
        title: zod_1.z.string().min(1, "Title is required"),
        date: zod_1.z.string().min(1, "Date is required"),
        time: zod_1.z.string().min(1, "Time is required"),
        relatedFarm: zod_1.z.string().min(1, "Related farm is required"),
        relatedAnimal: zod_1.z.string().optional(),
        purpose: zod_1.z.string().min(1, "Purpose is required"),
        setReminder: zod_1.z.boolean().default(false),
        notifyFarmStaff: zod_1.z.boolean().default(false)
    })
});
exports.logFarmVisitSchema = zod_1.z.object({
    body: zod_1.z.object({
        relatedFarm: zod_1.z.string().min(1, "Related farm is required"),
        date: zod_1.z.string().min(1, "Date is required"),
        time: zod_1.z.string().min(1, "Time is required"),
        reason: zod_1.z.string().min(1, "Reason for visit is required"),
        keyPersonnelMet: zod_1.z.string().min(1, "Key personnel met is required"),
        animalExamined: zod_1.z.string().min(1, "Animal examined is required"),
        farmObservation: zod_1.z.string().min(1, "Farm observation is required"),
        farmRecommendation: zod_1.z.string().min(1, "Farm recommendation is required"),
        mediaUrls: zod_1.z.array(zod_1.z.string().url("Media URL must be a valid URL")).optional().default([])
    })
});
