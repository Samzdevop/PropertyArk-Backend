import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';

export const createNote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { folderName, date, title, body } = req.body;

    const note = await prisma.note.create({
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

    sendSuccessResponse(res, 'Note created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getAllNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { page = 1, limit = 10, folderName } = req.query;

    const where: any = {
      recordedById: userId
    };

    if (folderName) {
      where.folderName = String(folderName);
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
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
      prisma.note.count({ where })
    ]);

    sendSuccessResponse(res, 'Notes retrieved successfully', {
      notes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getNoteById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { noteId } = req.params;

    const note = await prisma.note.findFirst({
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
      throw new NotFoundError('Note not found');
    }

    sendSuccessResponse(res, 'Note retrieved successfully', { note });
  } catch (error) {
    next(error);
  }
};

export const updateNote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { noteId } = req.params;
    const { folderName, date, title, body } = req.body;

    // Verify note exists and belongs to user
    const existingNote = await prisma.note.findFirst({
      where: {
        id: noteId,
        recordedById: userId
      }
    });

    if (!existingNote) {
      throw new NotFoundError('Note not found or you do not have permission to edit it');
    }

    const updatedNote = await prisma.note.update({
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

    sendSuccessResponse(res, 'Note updated successfully', { note: updatedNote });
  } catch (error) {
    next(error);
  }
};

export const deleteNote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { noteId } = req.params;

    // Verify note exists and belongs to user
    const existingNote = await prisma.note.findFirst({
      where: {
        id: noteId,
        recordedById: userId
      }
    });

    if (!existingNote) {
      throw new NotFoundError('Note not found or you do not have permission to delete it');
    }

    await prisma.note.delete({
      where: { id: noteId }
    });

    sendSuccessResponse(res, 'Note deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const getNoteFolders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;

    const folders = await prisma.note.groupBy({
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

    sendSuccessResponse(res, 'Note folders retrieved successfully', { folders });
  } catch (error) {
    next(error);
  }
};