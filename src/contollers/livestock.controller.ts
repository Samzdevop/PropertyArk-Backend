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
    const { companyId } = req.params;

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
        companyId,
      },
      include: {
        addedBy: { select: userSelect}, 
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
    const currentUser = (req.user as any);
    const where = { 
        companyId: currentUser.companyId,
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


export const getLivestockByCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const { companyId } = req.params; 
    const currentUser = (req.user as any);

    const where = { 
      companyId: companyId, 
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
    
    sendSuccessResponse(res, 'Livestock retrieved successfully for company', { 
      livestock,
      companyId,
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
    const currentUser = (req.user as any);
    const companyFilter = {
      companyId: currentUser.companyId,
      isDeleted: false
    };

    const [totalLivestock, sickLivestock] = await Promise.all([
      prisma.livestock.count({
        where: companyFilter
      }),
      prisma.livestock.count({
        where: {
          ...companyFilter,
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
    const currentUser = (req.user as any);
    const updateData = req.body;
    const updatedById = (req.user as any).id;
    const existingLivestock = await prisma.livestock.findUnique({
      where: {
        id: livestockId,
        companyId: currentUser.companyId
      }
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
      const currentUser = (req.user as any);
    const livestock = await prisma.livestock.findUnique({
      where: { 
        id: req.params.livestockId,
        companyId: currentUser.companyId 
      },
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


export const getLivestockHealthHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const livestockId = req.params.livestockId;

    // First, verify the livestock exists
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

    // Get all health-related records
    const [sicknessRecords, treatmentRecords, vaccinationRecords] = await Promise.all([
      // Sickness records
      prisma.sickness.findMany({
        where: {
          livestockId: livestockId
        },
        include: {
          recordedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          treatments: {
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
              dateOfTreatment: 'desc'
            }
          }
        },
        orderBy: {
          dateOfObservation: 'desc'
        }
      }),

      // Treatment records (including those not linked to sickness)
      prisma.treatment.findMany({
        where: {
          livestockId: livestockId
        },
        include: {
          recordedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          sickness: {
            select: { 
              id: true,
              dateOfObservation: true,
              observedSymptoms: true,
              recordedBy: { 
                select: {
                  id: true,
                  fullName: true,
                  role: true
                }
              }
            },
          }
        },
        orderBy: {
          dateOfTreatment: 'desc'
        }
      }),

      // Vaccination records
      prisma.vaccination.findMany({
        where: {
          livestockId: livestockId
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
          dateofVaccination: 'desc'
        }
      })
    ]);

    // Combine all health records into a single timeline
    const healthHistory = [
      ...sicknessRecords.map(record => ({
        type: 'SICKNESS' as const,
        id: record.id,
        date: record.dateOfObservation,
        description: `Sickness observed: ${record.observedSymptoms}`,
        details: record,
        recordedBy: record.recordedBy
      })),
      ...treatmentRecords.map(record => ({
        type: 'TREATMENT' as const,
        id: record.id,
        date: record.dateOfTreatment,
        description: `Treatment: ${record.treatmentType} for ${record.cause}`,
        details: record,
        recordedBy: record.recordedBy
      })),
      ...vaccinationRecords.map(record => ({
        type: 'VACCINATION' as const,
        id: record.id,
        date: record.dateofVaccination,
        description: `Vaccination: ${record.vaccineType}`,
        details: record,
        recordedBy: record.recordedBy
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending

    sendSuccessResponse(res, 'Livestock health history retrieved successfully', {
      livestock: {
        id: livestock.id,
        tagId: livestock.tagId,
        type: livestock.type
      },
      healthHistory,
      summary: {
        totalRecords: healthHistory.length,
        sicknessCount: sicknessRecords.length,
        treatmentCount: treatmentRecords.length,
        vaccinationCount: vaccinationRecords.length
      }
    });
  } catch (error) {
    next(error);
  }
};


export const getLivestockActivityTimeline = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const livestockId = req.params.livestockId;

    // First, verify the livestock exists
    const livestock = await prisma.livestock.findUnique({
      where: {
        id: livestockId,
        isDeleted: false
      },
      select: {
        id: true,
        tagId: true,
        type: true,
        breed: true,
        gender: true
      }
    });

    if (!livestock) {
      throw new NotFoundError('Livestock not found');
    }

    // Fetch all activities in parallel
    const [
      sicknessRecords,
      treatmentRecords,
      vaccinationRecords,
      taskRecords,
      taskObservations,
      offtakeRecords,
      diagnosisRecords,
      prescribedTreatments 
    ] = await Promise.all([
      // Sickness records
      prisma.sickness.findMany({
        where: { livestockId },
        include: {
          recordedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          treatments: {
            include: {
              recordedBy: {
                select: {
                  id: true,
                  fullName: true,
                  role: true
                }
              }
            }
          }
        },
        orderBy: { dateOfObservation: 'desc' }
      }),

      // Treatment records (including standalone treatments)
      prisma.treatment.findMany({
        where: { livestockId },
        include: {
          recordedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          sickness: {
            select: {
              id: true,
              dateOfObservation: true,
              observedSymptoms: true
            }
          }
        },
        orderBy: { dateOfTreatment: 'desc' }
      }),

      // Vaccination records
      prisma.vaccination.findMany({
        where: { livestockId },
        include: {
          recordedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          }
        },
        orderBy: { dateofVaccination: 'desc' }
      }),

      // Task records
      prisma.task.findMany({
        where: { livestockId },
        include: {
          assignedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          observations: {
            include: {
              reportedBy: {
                select: {
                  id: true,
                  fullName: true,
                  role: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Task observations (in case they're queried separately)
      prisma.taskObservation.findMany({
        where: {
          task: {
            livestockId: livestockId
          }
        },
        include: {
          reportedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          task: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        },
        orderBy: { reportedAt: 'desc' }
      }),

      // Offtake records
      prisma.offtakeRecord.findMany({
        where: { livestockId },
        include: {
          recordedBy: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          }
        },
        orderBy: { dateOfEvent: 'desc' }
      }),

       prisma.diagnosis.findMany({
        where: { livestockId },
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

      prisma.prescribedTreatment.findMany({
          where: { livestockId },
          include: {
            recordedBy: {
              select: {
                id: true,
                fullName: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
    ]);

    // Transform all records into a unified timeline
    const activityTimeline = [

      ...prescribedTreatments.map(treatment => ({
        type: 'PRESCRIBED_TREATMENT' as const,
        id: treatment.id,
        date: treatment.createdAt,
        title: 'Treatment Prescribed',
        description: `${treatment.treatmentType}: ${treatment.medicationName} - ${treatment.dosage} ${treatment.frequency.toLowerCase()}`,
        details: {
          treatmentType: treatment.treatmentType,
          medicationName: treatment.medicationName,
          dosage: treatment.dosage,
          frequency: treatment.frequency,
          routine: treatment.routine,
          startDate: treatment.startDate,
          endDate: treatment.endDate,
          additionalNotes: treatment.additionalNotes,
          isActive: treatment.isActive
        },
        recordedBy: treatment.recordedBy,
        entity: treatment
      })),

      ...diagnosisRecords.map(record => ({
        type: 'DIAGNOSIS' as const,
        id: record.id,
        date: record.date,
        title: 'Veterinary Diagnosis',
        description: `Diagnosis: ${record.diagnosis} - Severity: ${record.severity} - Prognosis: ${record.prognosis}`,
        details: {
          diagnosis: record.diagnosis,
          labTests: record.labTests,
          severity: record.severity,
          prognosis: record.prognosis,
          observations: record.observations
        },
        recordedBy: record.recordedBy,
        entity: record
      })),
      // Sickness activities
      ...sicknessRecords.map(record => ({
        type: 'SICKNESS_REPORTED' as const,
        id: record.id,
        date: record.dateOfObservation,
        title: 'Sickness Reported',
        description: `Symptoms: ${record.observedSymptoms}. Suspected cause: ${record.suspectedCause}`,
        details: {
          symptoms: record.observedSymptoms,
          suspectedCause: record.suspectedCause,
          notes: record.notes,
          treatments: record.treatments
        },
        recordedBy: record.recordedBy,
        entity: record
      })),

      // Treatment activities
      ...treatmentRecords.map(record => ({
        type: record.sicknessId ? 'TREATMENT_ADMINISTERED' : 'PREVENTIVE_TREATMENT' as const,
        id: record.id,
        date: record.dateOfTreatment,
        title: record.sicknessId ? 'Treatment Administered' : 'Preventive Treatment',
        description: `${record.treatmentType} for ${record.cause} - Dosage: ${record.dosage}`,
        details: {
          treatmentType: record.treatmentType,
          dosage: record.dosage,
          cause: record.cause,
          administeredBy: record.administeredBy,
          nextDueDate: record.nextDueDate,
          relatedSickness: record.sickness
        },
        recordedBy: record.recordedBy,
        entity: record
      })),

      // Vaccination activities
      ...vaccinationRecords.map(record => ({
        type: 'VACCINATION' as const,
        id: record.id,
        date: record.dateofVaccination,
        title: 'Vaccination Administered',
        description: `${record.vaccineType} vaccine - Dosage: ${record.dosage}`,
        details: {
          vaccineType: record.vaccineType,
          dosage: record.dosage,
          administeredBy: record.administeredBy,
          nextDueDate: record.nextDueDate
        },
        recordedBy: record.recordedBy,
        entity: record
      })),

      // Task activities
      ...taskRecords.map(record => ({
        type: 'TASK_CREATED' as const,
        id: record.id,
        date: record.createdAt,
        title: 'Task Created',
        description: `Task: ${record.name} - Priority: ${record.priority} - Status: ${record.status}`,
        details: {
          taskName: record.name,
          description: record.description,
          priority: record.priority,
          status: record.status,
          dueDate: record.dueDate,
          assignedTo: record.assignedTo,
          observations: record.observations
        },
        recordedBy: record.assignedBy,
        entity: record
      })),

      // Task observation activities
      ...taskObservations.map(record => ({
        type: 'TASK_OBSERVATION' as const,
        id: record.id,
        date: record.reportedAt,
        title: 'Task Observation Added',
        description: `Observation for task: ${record.task.name}`,
        details: {
          note: record.note,
          mediaUrls: record.mediaUrls,
          task: record.task
        },
        recordedBy: record.reportedBy,
        entity: record
      })),

      // Offtake activities
      ...offtakeRecords.map(record => ({
        type: 'OFFTAKE' as const,
        id: record.id,
        date: record.dateOfEvent,
        title: `Livestock ${record.type.toLowerCase()}`,
        description: record.type === 'DEATH' 
          ? `Cause of death: ${record.causeOfDeath}`
          : record.type === 'SALE'
          ? `Sold for $${record.price} - Destination: ${record.destination}`
          : `Livestock reported missing`,
        details: {
          type: record.type,
          destination: record.destination,
          price: record.price,
          causeOfDeath: record.causeOfDeath,
          notes: record.notes
        },
        recordedBy: record.recordedBy,
        entity: record
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Most recent first

    // Count activities by type
    const activitySummary = {
      prescribedTreatments: prescribedTreatments.length,
      diagnosis: diagnosisRecords.length,
      sickness: sicknessRecords.length,
      treatments: treatmentRecords.length,
      vaccinations: vaccinationRecords.length,
      tasks: taskRecords.length,
      taskObservations: taskObservations.length,
      offtake: offtakeRecords.length,
      total: activityTimeline.length
    };

    sendSuccessResponse(res, 'Livestock activity timeline retrieved successfully', {
      livestock: {
        id: livestock.id,
        tagId: livestock.tagId,
        type: livestock.type,
        breed: livestock.breed,
        gender: livestock.gender
      },
      activityTimeline,
      summary: activitySummary
    });
  } catch (error) {
    next(error);
  }
};