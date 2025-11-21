"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNoteSchema = exports.createNoteSchema = void 0;
const zod_1 = require("zod");
exports.createNoteSchema = zod_1.z.object({
    body: zod_1.z.object({
        folderName: zod_1.z.string().min(1, "Folder name is required"),
        date: zod_1.z.string().min(1, "Date is required"),
        title: zod_1.z.string().min(1, "Title is required"),
        body: zod_1.z.string().min(1, "Body is required")
    })
});
exports.updateNoteSchema = zod_1.z.object({
    body: zod_1.z.object({
        folderName: zod_1.z.string().min(1, "Folder name is required").optional(),
        date: zod_1.z.string().min(1, "Date is required").optional(),
        title: zod_1.z.string().min(1, "Title is required").optional(),
        body: zod_1.z.string().min(1, "Body is required").optional()
    })
});
