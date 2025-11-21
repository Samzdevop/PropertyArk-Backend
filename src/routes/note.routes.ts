import { Router } from 'express';
import {
  createNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  getNoteFolders
} from '../contollers/note.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createNoteSchema,
  updateNoteSchema
} from '../schemas/note.schemas';

export const noteRouter = Router();

// Create note
noteRouter.post(
  '/',
  authenticateJWT,
  validateRequest(createNoteSchema),
  createNote
);

// Get all notes with optional folder filter
noteRouter.get(
  '/',
  authenticateJWT,
  getAllNotes
);

// Get note by ID
noteRouter.get(
  '/:noteId',
  authenticateJWT,
  getNoteById
);

// Update note
noteRouter.put(
  '/:noteId',
  authenticateJWT,
  validateRequest(updateNoteSchema),
  updateNote
);

// Delete note
noteRouter.delete(
  '/:noteId',
  authenticateJWT,
  deleteNote
);

// Get note folders
noteRouter.get(
  '/folders/list',
  authenticateJWT,
  getNoteFolders
);