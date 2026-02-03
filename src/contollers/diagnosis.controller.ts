import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';

export const createDiagnosis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const livestockId = req.params.livestockId; 
    
    // Only VET can create diagnosis
    if (userRole !== 'VET') {
      throw new ForbiddenError('Only veterinarians can create diagnoses');
    }

    const {diagnosis, labTests, severity, prognosis, observations, date } = req.body;

    // Verify livestock exists
    const livestock = await prisma.livestock.findUnique({
      where: {
        id: livestockId,
        isDeleted: false
      }
    });

    if (!livestock) {
      throw new NotFoundError('Livestock not found');
    }

    const newDiagnosis = await prisma.diagnosis.create({
      data: {
        livestockId,
        diagnosis,
        labTests,
        severity,
        prognosis,
        observations,
        date: new Date(date),
        recordedById: userId
      },
      include: {
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        },
        livestock: {
          select: {
            id: true,
            tagId: true,
            type: true,
            breed: true
          }
        }
      }
    });

    sendSuccessResponse(res, 'Diagnosis created successfully', { diagnosis: newDiagnosis }, 201);
  } catch (error) {
    next(error);
  }
};

export const updateDiagnosis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const diagnosisId = req.params.diagnosisId;
    
    // Only VET can update diagnosis
    if (userRole !== 'VET') {
      throw new ForbiddenError('Only veterinarians can update diagnoses');
    }

    const { diagnosis, labTests, severity, prognosis, observations, date } = req.body;

    // Verify diagnosis exists and was created by this vet
    const existingDiagnosis = await prisma.diagnosis.findFirst({
      where: {
        id: diagnosisId,
        recordedById: userId 
      },
      include: {
        livestock: {
          select: {
            id: true,
            tagId: true
          }
        }
      }
    });

    if (!existingDiagnosis) {
      throw new NotFoundError('Diagnosis not found or you do not have permission to edit it');
    }

    const updatedDiagnosis = await prisma.diagnosis.update({
      where: { id: diagnosisId },
      data: {
        diagnosis,
        labTests,
        severity,
        prognosis,
        observations,
        date: date ? new Date(date) : undefined
      },
      include: {
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        },
        livestock: {
          select: {
            id: true,
            tagId: true,
            type: true,
            breed: true
          }
        }
      }
    });

    sendSuccessResponse(res, 'Diagnosis updated successfully', { diagnosis: updatedDiagnosis });
  } catch (error) {
    next(error);
  }
};

export const getLivestockDiagnoses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const livestockId = req.params.livestockId;

    // Verify livestock exists
    const livestock = await prisma.livestock.findUnique({
      where: {
        id: livestockId,
        isDeleted: false
      },
      select: {
        id: true,
        tagId: true,
        type: true
      }
    });

    if (!livestock) {
      throw new NotFoundError('Livestock not found');
    }

    const diagnoses = await prisma.diagnosis.findMany({
      where: {
        livestockId
      },
      include: {
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    sendSuccessResponse(res, 'Diagnoses retrieved successfully', {
      livestock,
      diagnoses,
      count: diagnoses.length
    });
  } catch (error) {
    next(error);
  }
};

export const getDiagnosis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const diagnosisId = req.params.diagnosisId;

    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id: diagnosisId },
      include: {
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        },
        livestock: {
          select: {
            id: true,
            tagId: true,
            type: true,
            breed: true,
            gender: true
          }
        }
      }
    });

    if (!diagnosis) {
      throw new NotFoundError('Diagnosis not found');
    }

    sendSuccessResponse(res, 'Diagnosis retrieved successfully', { diagnosis });
  } catch (error) {
    next(error);
  }
};

export const deleteDiagnosis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const diagnosisId = req.params.diagnosisId;
    
    // Only VET can delete diagnosis
    if (userRole !== 'VET') {
      throw new ForbiddenError('Only veterinarians can delete diagnoses');
    }

    // Verify diagnosis exists and was created by this vet
    const existingDiagnosis = await prisma.diagnosis.findFirst({
      where: {
        id: diagnosisId,
        recordedById: userId
      }
    });

    if (!existingDiagnosis) {
      throw new NotFoundError('Diagnosis not found or you do not have permission to delete it');
    }

    await prisma.diagnosis.delete({
      where: { id: diagnosisId }
    });

    sendSuccessResponse(res, 'Diagnosis deleted successfully');
  } catch (error) {
    next(error);
  }
};