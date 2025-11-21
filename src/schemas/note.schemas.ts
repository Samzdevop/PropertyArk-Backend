import { z } from 'zod';

export const createNoteSchema = z.object({
  body: z.object({
    folderName: z.string().min(1, "Folder name is required"),
    date: z.string().min(1, "Date is required"),
    title: z.string().min(1, "Title is required"),
    body: z.string().min(1, "Body is required")
  })
});

export const updateNoteSchema = z.object({
  body: z.object({
    folderName: z.string().min(1, "Folder name is required").optional(),
    date: z.string().min(1, "Date is required").optional(),
    title: z.string().min(1, "Title is required").optional(),
    body: z.string().min(1, "Body is required").optional()
  })
});