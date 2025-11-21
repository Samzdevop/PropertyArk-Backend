"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNoteFolders = exports.deleteNote = exports.updateNote = exports.getNoteById = exports.getAllNotes = exports.createNote = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const createNote = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { folderName, date, title, body } = req.body;
        const note = await prisma_1.default.note.create({
            data: {
                folderName,
                date: new Date(date),
                title,
                body,
                recordedById: userId
            },
            include: {
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note created successfully', 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createNote = createNote;
const getAllNotes = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, folderName } = req.query;
        const where = {
            recordedById: userId
        };
        if (folderName) {
            where.folderName = String(folderName);
        }
        const [notes, total] = await Promise.all([
            prisma_1.default.note.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                include: {
                    recordedBy: {
                        select: {
                            id: true,
                            fullName: true,
                            role: true
                        }
                    }
                },
                orderBy: { date: 'desc' }
            }),
            prisma_1.default.note.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Notes retrieved successfully', {
            notes,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllNotes = getAllNotes;
const getNoteById = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { noteId } = req.params;
        const note = await prisma_1.default.note.findFirst({
            where: {
                id: noteId,
                recordedById: userId
            },
            include: {
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                }
            }
        });
        if (!note) {
            throw new NotFoundError_1.NotFoundError('Note not found');
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note retrieved successfully', { note });
    }
    catch (error) {
        next(error);
    }
};
exports.getNoteById = getNoteById;
const updateNote = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { noteId } = req.params;
        const { folderName, date, title, body } = req.body;
        // Verify note exists and belongs to user
        const existingNote = await prisma_1.default.note.findFirst({
            where: {
                id: noteId,
                recordedById: userId
            }
        });
        if (!existingNote) {
            throw new NotFoundError_1.NotFoundError('Note not found or you do not have permission to edit it');
        }
        const updatedNote = await prisma_1.default.note.update({
            where: { id: noteId },
            data: {
                ...(folderName && { folderName }),
                ...(date && { date: new Date(date) }),
                ...(title && { title }),
                ...(body && { body })
            },
            include: {
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note updated successfully', { note: updatedNote });
    }
    catch (error) {
        next(error);
    }
};
exports.updateNote = updateNote;
const deleteNote = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { noteId } = req.params;
        // Verify note exists and belongs to user
        const existingNote = await prisma_1.default.note.findFirst({
            where: {
                id: noteId,
                recordedById: userId
            }
        });
        if (!existingNote) {
            throw new NotFoundError_1.NotFoundError('Note not found or you do not have permission to delete it');
        }
        await prisma_1.default.note.delete({
            where: { id: noteId }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteNote = deleteNote;
const getNoteFolders = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const folders = await prisma_1.default.note.groupBy({
            by: ['folderName'],
            where: {
                recordedById: userId
            },
            _count: {
                _all: true
            },
            orderBy: {
                folderName: 'asc'
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Note folders retrieved successfully', { folders });
    }
    catch (error) {
        next(error);
    }
};
exports.getNoteFolders = getNoteFolders;
