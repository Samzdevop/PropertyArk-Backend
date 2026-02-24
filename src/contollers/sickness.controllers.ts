import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { userSelect } from '../prisma/selects';
import { BadRequestError } from '../errors/BadRequestError';

export const reportSickness = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dateOfObservation, observedSymptoms, suspectedCause, notes, healthStatus } = req.body;
    const livestockId = req.params.livestockId;
    const recordedById = (req.user as any).id;

     if (healthStatus && !['SICK', 'CRITICAL'].includes(healthStatus)) {
      throw new BadRequestError('Health status must be either SICK or CRITICAL when reporting sickness');
    }
    // Verify livestock exists
    const livestock = await prisma.livestock.findUnique({
      where: { id: livestockId }
    });
    if (!livestock) throw new NotFoundError('Livestock not found');

    // Create sickness record and update livestock status in a transaction
    const [sickness] = await prisma.$transaction([
      prisma.sickness.create({
        data: {
          livestockId,
          dateOfObservation: new Date(dateOfObservation),
          observedSymptoms,
          suspectedCause,
          notes,
          recordedById,
        },
        include: {
          livestock: true,
          recordedBy: { select: userSelect },
        },
      }),
      prisma.livestock.update({
        where: { id: livestockId },
        data: { 
          isSick: true,
          healthStatus: healthStatus || 'SICK' 
        },
      }),
    ]);

    sendSuccessResponse(
      res,
      'Sickness successfully reported',
      { sickness },
      201
    );
  } catch (error) {
    next(error);
  }
};

// Get all sickness records
export const getAllSickness = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user as any;
    const { page = 1, limit = 10, livestockId } = req.query;
    
    const where = {
      ...(livestockId && { livestockId: String(livestockId) }),
      livestock: {
        companyId: currentUser.companyId,
        isDeleted: false
      }
    };

    const sicknessRecords = await prisma.sickness.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: {
        livestock: true,
        recordedBy: { select: userSelect },
        treatments: true
      },
      orderBy: { dateOfObservation: 'desc' }
    });

    const total = await prisma.sickness.count({ where });

    sendSuccessResponse(res, 'Sickness records retrieved', {
      sicknessRecords,
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

// Get single sickness record
export const getSicknessById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sickness = await prisma.sickness.findUnique({
      where: { id: req.params.sicknessId },
      include: {
        livestock: true,
        recordedBy: { select: userSelect },
        treatments: true
      }
    });

    if (!sickness) throw new NotFoundError('Sickness record not found');
    sendSuccessResponse(res, 'Sickness record retrieved', { sickness });
  } catch (error) {
    next(error);
  }
};