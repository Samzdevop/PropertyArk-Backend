"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLivestockSchema = exports.updateLivestockSchema = exports.addLivestockSchema = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
exports.addLivestockSchema = zod_1.z.object({
    body: zod_1.z.object({
        tagId: zod_1.z.string().min(1, "Tag ID is required"),
        type: zod_1.z.string().min(1, "Type is required"),
        breed: zod_1.z.string().optional(),
        healthStatus: zod_1.z.enum(['HEALTHY', 'SICK', 'IN_TREATMENT', 'RECOVERING', 'CRITICAL']).default('HEALTHY'),
        birthDate: zod_1.z.string().optional(),
        weight: zod_1.z.number().min(0, "Weight must be a positive number").optional(),
        gender: zod_1.z.string().min(1, 'Gender is required'),
        livestockSource: zod_1.z.string().optional(),
        livestockPurpose: zod_1.z.string().min(1, 'Purpose is required'),
    }),
});
exports.updateLivestockSchema = zod_1.z.object({
    body: zod_1.z.object({
        tagId: zod_1.z.string().min(1, 'Tag ID is required').optional(),
        type: zod_1.z.string().min(1, 'Type is required').optional(),
        breed: zod_1.z.string().optional(),
        birthDate: zod_1.z.string().optional(),
        healthStatus: zod_1.z.enum(['HEALTHY', 'SICK', 'IN_TREATMENT', 'RECOVERING', 'CRITICAL']).optional(),
        weight: zod_1.z.number().min(0, 'Weight must be positive').optional(),
        gender: zod_1.z.string().min(1, 'Gender is required').optional(),
        livestockSource: zod_1.z.string().optional(),
        livestockPurpose: zod_1.z.string().optional()
    }),
});
exports.deleteLivestockSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().min(1, "Reason is required for farm keepers").optional()
    }).refine(data => {
        const userRole = express_1.request?.user?.role;
        if (userRole === 'FARM_KEEPER') {
            return !!data.reason;
        }
        return true;
    }, {
        message: "Deletion reason is required for farm keepers",
        path: ["reason"]
    })
});
