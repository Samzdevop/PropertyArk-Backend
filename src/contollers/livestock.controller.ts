import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { userSelect } from '../prisma/selects';
import { BadRequestError } from '../errors/BadRequestError';
import { ForbiddenError } from '../errors/ForbiddenError';

export const addLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      tagId, 
      type, 
      breed, 
      birthDate, 
      healthStatus,
      weight,
      gender,
      livestockSource,
      livestockPurpose
    } = req.body;
    
    const addedById = (req.user as any).id;

    const livestock = await prisma.livestock.create({
      data: {
        tagId,
        type,
        breed,
        birthDate: birthDate ? new Date(birthDate) : null,
        healthStatus,
        weight: weight ? parseFloat(weight) : null,
        gender,
        livestockSource,
        livestockPurpose,
        addedById,
      },
      include: {
        addedBy: { select: userSelect}, // Include the user who added the livestock
      },
    });

    sendSuccessResponse(
      res,
      'Livestock successfully added',
      { livestock },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getLivestockById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const livestock = await prisma.livestock.findUnique({
      where: { 
        id: req.params.livestockId,
      },
      include: { 
        addedBy: {select: userSelect},
        updatedBy: {select: userSelect}
      },
    });

    if (!livestock) throw new NotFoundError('Livestock not found');
    sendSuccessResponse(res, 'Livestock retrieved successfully', { livestock });
  } catch (error) {
    next(error);
  }
};

export const getAllLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const where = { 
        isDeleted: false,
      ...(type && { type: String(type) }) 
    };

    const livestock = await prisma.livestock.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { 
        addedBy: { select: userSelect },
        vaccinationRecords: {
          orderBy: {dateofVaccination: 'desc'},
          select: {
            id: true,
            dateofVaccination: true,
            vaccineType: true,
            dosage: true,
            administeredBy: true,
            nextDueDate: true
          }
        },
        treatments: {
          orderBy: {dateOfTreatment: 'desc'},
          select: {
            id: true,
            dateOfTreatment: true,
            nextDueDate: true,
            treatmentType: true,
            dosage: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.livestock.count({ where });
    sendSuccessResponse(res, 'Livestock retrieved successfully', { 
      livestock,
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

export const getLivestockCounts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
   try {
    const [totalLivestock, sickLivestock] = await Promise.all([
      prisma.livestock.count({
        where: { 
          isDeleted: false
        }
      }),
      prisma.livestock.count({
        where: {
          isDeleted: false,
          healthStatus: {
            in: ['SICK', 'IN_TREATMENT', 'CRITICAL'] 
          },
          sickness: {
            some: {}
          }
        }
      })
    ]);

    sendSuccessResponse(res, 'Livestock counts retrieved', {
      totalLivestock,
      sickLivestock
    });
  } catch (error) {
    next(error);
  }
};

export const updateLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const livestockId = req.params.livestockId;
    const updateData = req.body;
    const updatedById = (req.user as any).id;
    const existingLivestock = await prisma.livestock.findUnique({
      where: { id: livestockId }
    });

    if (!existingLivestock) {
      throw new NotFoundError('Livestock not found');
    }
    const livestock = await prisma.livestock.update({
      where: { id: livestockId },
      data: {
        ...updateData,
        updatedById,
        updatedAt: new Date() // Explicit timestamp update
      },
      include: {
        addedBy: { select: userSelect },
        updatedBy: { select: userSelect }
      }
    });

    sendSuccessResponse(res, 'Livestock updated successfully', { livestock });
  } catch (error) {
    next(error);
  }
};

// permenant delete livestock
export const deleteLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const livestock = await prisma.livestock.findUnique({
      where: { id: req.params.livestockId },
    });

    if (!livestock) throw new NotFoundError('Livestock not found');

    await prisma.livestock.delete({
      where: { id: req.params.livestockId, },
    });
    sendSuccessResponse(res, 'Livestock deleted successfully!', { livestock });
  } catch (error) {
    next(error);
  }
};


// This will mark the livestock as deleted without removing it from the database
export const softDeleteLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { livestockId } = req.params;
    const { reason } = req.body;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Verify livestock exists
    const livestock = await prisma.livestock.findUnique({
      where: { id: livestockId, isDeleted: false }
    });

    if (!livestock) {
      throw new NotFoundError('Livestock not found');
    }

     if (userRole === 'FARM_KEEPER' && !reason) {
      throw new BadRequestError('Deletion reason is required for farm keepers');
    }

    // Determine the deletion reason
    const finalReason = reason || (userRole === 'ADMIN' ? 'Admin deletion' : null);

    // Soft delete
    const deletedLivestock = await prisma.livestock.update({
      where: { id: livestockId },
      data: {
        isDeleted: true,
        deletionReason: finalReason,
        deletedAt: new Date(),
        deletedById: userId
      },
      include: {
        addedBy: { select: userSelect },
        deletedBy: { select: userSelect }
      }
    });

    sendSuccessResponse(res, 'Livestock deleted successfully', { livestock: deletedLivestock });
  } catch (error) {
    next(error);
  }
};

// Get deleted livestock (Admin only)
export const getDeletedLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const [deletedLivestock, total] = await Promise.all([
      prisma.livestock.findMany({
        where: { isDeleted: true },
        include: {
          addedBy: { select: userSelect },
          deletedBy: { select: userSelect }
        },
        orderBy: { deletedAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.livestock.count({ where: { isDeleted: true } })
    ]);

    sendSuccessResponse(res, 'Deleted livestock retrieved', {
      deletedLivestock,
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

// Restore livestock (Admin only)
export const restoreLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { livestockId } = req.params;

    const livestock = await prisma.livestock.update({
      where: { id: livestockId, isDeleted: true },
      data: {
        isDeleted: false,
        deletionReason: null,
        deletedAt: null,
        deletedById: null
      }
    });

    if (!livestock) {
      throw new NotFoundError('Deleted livestock not found');
    }

    sendSuccessResponse(res, 'Livestock restored successfully', { livestock });
  } catch (error) {
    next(error);
  }
};

export const getFarmLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const vetId = (req.user as any).id;
    const vetRole = (req.user as any).role;
    const { companyId } = req.params;
    const { page = 1, limit = 10, healthStatus, type } = req.query;

    // Only vets can access this endpoint
    if (vetRole !== 'VET') {
      throw new ForbiddenError('Only vets can access farm livestock');
    }

    // Verify the vet has tasks from this company
    const hasAccess = await prisma.task.findFirst({
      where: {
        assignedToId: vetId,
        assignedById: companyId
      }
    });

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this farm\'s livestock');
    }

    // Get company name
    const company = await prisma.user.findUnique({
      where: { id: companyId },
      select: { companyName: true }
    });

    if (!company) {
      throw new NotFoundError('Farm not found');
    }

    const where: any = {
      addedBy: {
        companyName: company.companyName
      },
      isDeleted: false,
      ...(healthStatus && { healthStatus: String(healthStatus) }),
      ...(type && { type: String(type) })
    };

    const [livestock, total] = await Promise.all([
      prisma.livestock.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          addedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          vaccinationRecords: {
            orderBy: { dateofVaccination: 'desc' },
            take: 3,
            select: {
              id: true,
              dateofVaccination: true,
              vaccineType: true,
              nextDueDate: true
            }
          },
          sickness: {
            orderBy: { dateOfObservation: 'desc' },
            take: 3,
            include: {
              treatments: {
                orderBy: { dateOfTreatment: 'desc' },
                take: 1
              }
            }
          },
          treatments: {
            orderBy: { dateOfTreatment: 'desc' },
            take: 3
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.livestock.count({ where })
    ]);

    sendSuccessResponse(res, 'Farm livestock retrieved successfully', {
      livestock,
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
