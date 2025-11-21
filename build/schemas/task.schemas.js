"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskObservationSchema = exports.updateTaskStatusSchema = exports.createTaskSchema = void 0;
const zod_1 = require("zod");
exports.createTaskSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, "Task name is required"),
        description: zod_1.z.string().min(1, "Description is required"),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']),
        dueDate: zod_1.z.string().min(1, "Due date is required"),
        assignedToId: zod_1.z.string().min(1, "Assignee ID is required"),
        livestockId: zod_1.z.string().optional(),
    }),
});
exports.updateTaskStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'])
    }),
});
exports.createTaskObservationSchema = zod_1.z.object({
    body: zod_1.z.object({
        note: zod_1.z.string().min(1, "Observation note is required")
    })
});
