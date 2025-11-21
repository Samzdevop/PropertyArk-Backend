"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noteRouter = void 0;
const express_1 = require("express");
const note_controller_1 = require("../contollers/note.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const note_schemas_1 = require("../schemas/note.schemas");
exports.noteRouter = (0, express_1.Router)();
// Create note
exports.noteRouter.post('/', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(note_schemas_1.createNoteSchema), note_controller_1.createNote);
// Get all notes with optional folder filter
exports.noteRouter.get('/', errorHandler_1.authenticateJWT, note_controller_1.getAllNotes);
// Get note by ID
exports.noteRouter.get('/:noteId', errorHandler_1.authenticateJWT, note_controller_1.getNoteById);
// Update note
exports.noteRouter.put('/:noteId', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(note_schemas_1.updateNoteSchema), note_controller_1.updateNote);
// Delete note
exports.noteRouter.delete('/:noteId', errorHandler_1.authenticateJWT, note_controller_1.deleteNote);
// Get note folders
exports.noteRouter.get('/folders/list', errorHandler_1.authenticateJWT, note_controller_1.getNoteFolders);
