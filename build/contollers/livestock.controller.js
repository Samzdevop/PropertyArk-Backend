"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLivestockActivityTimeline = exports.getLivestockHealthHistory = exports.getFarmLivestock = exports.restoreLivestock = exports.getDeletedLivestock = exports.softDeleteLivestock = exports.deleteLivestock = exports.updateLivestock = exports.getLivestockCounts = exports.getAllLivestock = exports.getLivestockById = exports.addLivestock = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const selects_1 = require("../prisma/selects");
const BadRequestError_1 = require("../errors/BadRequestError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const addLivestock = async (req, res, next) => {
    try {
        const { tagId, type, breed, birthDate, healthStatus, weight, gender, livestockSource, livestockPurpose } = req.body;
        const addedById = req.user.id;
        const livestock = await prisma_1.default.livestock.create({
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
                addedBy: { select: selects_1.userSelect }, // Include the user who added the livestock
            },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock successfully added', { livestock }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.addLivestock = addLivestock;
const getLivestockById = async (req, res, next) => {
    try {
        const livestock = await prisma_1.default.livestock.findUnique({
            where: {
                id: req.params.livestockId,
            },
            include: {
                addedBy: { select: selects_1.userSelect },
                updatedBy: { select: selects_1.userSelect }
            },
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock retrieved successfully', { livestock });
    }
    catch (error) {
        next(error);
    }
};
exports.getLivestockById = getLivestockById;
const getAllLivestock = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const where = {
            isDeleted: false,
            ...(type && { type: String(type) })
        };
        const livestock = await prisma_1.default.livestock.findMany({
            where,
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
            include: {
                addedBy: { select: selects_1.userSelect },
                vaccinationRecords: {
                    orderBy: { dateofVaccination: 'desc' },
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
                    orderBy: { dateOfTreatment: 'desc' },
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
        const total = await prisma_1.default.livestock.count({ where });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock retrieved successfully', {
            livestock,
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
exports.getAllLivestock = getAllLivestock;
const getLivestockCounts = async (req, res, next) => {
    try {
        const [totalLivestock, sickLivestock] = await Promise.all([
            prisma_1.default.livestock.count({
                where: {
                    isDeleted: false
                }
            }),
            prisma_1.default.livestock.count({
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
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock counts retrieved', {
            totalLivestock,
            sickLivestock
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getLivestockCounts = getLivestockCounts;
const updateLivestock = async (req, res, next) => {
    try {
        const livestockId = req.params.livestockId;
        const updateData = req.body;
        const updatedById = req.user.id;
        const existingLivestock = await prisma_1.default.livestock.findUnique({
            where: { id: livestockId }
        });
        if (!existingLivestock) {
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        }
        const livestock = await prisma_1.default.livestock.update({
            where: { id: livestockId },
            data: {
                ...updateData,
                updatedById,
                updatedAt: new Date() // Explicit timestamp update
            },
            include: {
                addedBy: { select: selects_1.userSelect },
                updatedBy: { select: selects_1.userSelect }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock updated successfully', { livestock });
    }
    catch (error) {
        next(error);
    }
};
exports.updateLivestock = updateLivestock;
// permenant delete livestock
const deleteLivestock = async (req, res, next) => {
    try {
        const livestock = await prisma_1.default.livestock.findUnique({
            where: { id: req.params.livestockId },
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        await prisma_1.default.livestock.delete({
            where: { id: req.params.livestockId, },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock deleted successfully!', { livestock });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteLivestock = deleteLivestock;
// This will mark the livestock as deleted without removing it from the database
const softDeleteLivestock = async (req, res, next) => {
    try {
        const { livestockId } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        // Verify livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
            where: { id: livestockId, isDeleted: false }
        });
        if (!livestock) {
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        }
        if (userRole === 'FARM_KEEPER' && !reason) {
            throw new BadRequestError_1.BadRequestError('Deletion reason is required for farm keepers');
        }
        // Determine the deletion reason
        const finalReason = reason || (userRole === 'ADMIN' ? 'Admin deletion' : null);
        // Soft delete
        const deletedLivestock = await prisma_1.default.livestock.update({
            where: { id: livestockId },
            data: {
                isDeleted: true,
                deletionReason: finalReason,
                deletedAt: new Date(),
                deletedById: userId
            },
            include: {
                addedBy: { select: selects_1.userSelect },
                deletedBy: { select: selects_1.userSelect }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock deleted successfully', { livestock: deletedLivestock });
    }
    catch (error) {
        next(error);
    }
};
exports.softDeleteLivestock = softDeleteLivestock;
// Get deleted livestock (Admin only)
const getDeletedLivestock = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const [deletedLivestock, total] = await Promise.all([
            prisma_1.default.livestock.findMany({
                where: { isDeleted: true },
                include: {
                    addedBy: { select: selects_1.userSelect },
                    deletedBy: { select: selects_1.userSelect }
                },
                orderBy: { deletedAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit)
            }),
            prisma_1.default.livestock.count({ where: { isDeleted: true } })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Deleted livestock retrieved', {
            deletedLivestock,
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
exports.getDeletedLivestock = getDeletedLivestock;
// Restore livestock (Admin only)
const restoreLivestock = async (req, res, next) => {
    try {
        const { livestockId } = req.params;
        const livestock = await prisma_1.default.livestock.update({
            where: { id: livestockId, isDeleted: true },
            data: {
                isDeleted: false,
                deletionReason: null,
                deletedAt: null,
                deletedById: null
            }
        });
        if (!livestock) {
            throw new NotFoundError_1.NotFoundError('Deleted livestock not found');
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock restored successfully', { livestock });
    }
    catch (error) {
        next(error);
    }
};
exports.restoreLivestock = restoreLivestock;
const getFarmLivestock = async (req, res, next) => {
    try {
        const vetId = req.user.id;
        const vetRole = req.user.role;
        const { companyId } = req.params;
        const { page = 1, limit = 10, healthStatus, type } = req.query;
        // Only vets can access this endpoint
        if (vetRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only vets can access farm livestock');
        }
        // Verify the vet has tasks from this company
        const hasAccess = await prisma_1.default.task.findFirst({
            where: {
                assignedToId: vetId,
                assignedById: companyId
            }
        });
        if (!hasAccess) {
            throw new ForbiddenError_1.ForbiddenError('You do not have access to this farm\'s livestock');
        }
        // Get company name
        const company = await prisma_1.default.user.findUnique({
            where: { id: companyId },
            select: { companyName: true }
        });
        if (!company) {
            throw new NotFoundError_1.NotFoundError('Farm not found');
        }
        const where = {
            addedBy: {
                companyName: company.companyName
            },
            isDeleted: false,
            ...(healthStatus && { healthStatus: String(healthStatus) }),
            ...(type && { type: String(type) })
        };
        const [livestock, total] = await Promise.all([
            prisma_1.default.livestock.findMany({
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
            prisma_1.default.livestock.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Farm livestock retrieved successfully', {
            livestock,
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
exports.getFarmLivestock = getFarmLivestock;
const getLivestockHealthHistory = async (req, res, next) => {
    try {
        const livestockId = req.params.livestockId;
        // First, verify the livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
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
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        }
        // Get all health-related records
        const [sicknessRecords, treatmentRecords, vaccinationRecords] = await Promise.all([
            // Sickness records
            prisma_1.default.sickness.findMany({
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
            prisma_1.default.treatment.findMany({
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
                            observedSymptoms: true
                        }
                    }
                },
                orderBy: {
                    dateOfTreatment: 'desc'
                }
            }),
            // Vaccination records
            prisma_1.default.vaccination.findMany({
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
                type: 'SICKNESS',
                id: record.id,
                date: record.dateOfObservation,
                description: `Sickness observed: ${record.observedSymptoms}`,
                details: record,
                recordedBy: record.recordedBy
            })),
            ...treatmentRecords.map(record => ({
                type: 'TREATMENT',
                id: record.id,
                date: record.dateOfTreatment,
                description: `Treatment: ${record.treatmentType} for ${record.cause}`,
                details: record,
                recordedBy: record.recordedBy
            })),
            ...vaccinationRecords.map(record => ({
                type: 'VACCINATION',
                id: record.id,
                date: record.dateofVaccination,
                description: `Vaccination: ${record.vaccineType}`,
                details: record,
                recordedBy: record.recordedBy
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock health history retrieved successfully', {
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
    }
    catch (error) {
        next(error);
    }
};
exports.getLivestockHealthHistory = getLivestockHealthHistory;
const getLivestockActivityTimeline = async (req, res, next) => {
    try {
        const livestockId = req.params.livestockId;
        // First, verify the livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
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
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        }
        // Fetch all activities in parallel
        const [sicknessRecords, treatmentRecords, vaccinationRecords, taskRecords, taskObservations, offtakeRecords, diagnosisRecords, prescribedTreatments] = await Promise.all([
            // Sickness records
            prisma_1.default.sickness.findMany({
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
            prisma_1.default.treatment.findMany({
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
            prisma_1.default.vaccination.findMany({
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
            prisma_1.default.task.findMany({
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
            prisma_1.default.taskObservation.findMany({
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
            prisma_1.default.offtakeRecord.findMany({
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
            prisma_1.default.diagnosis.findMany({
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
            prisma_1.default.prescribedTreatment.findMany({
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
                type: 'PRESCRIBED_TREATMENT',
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
                type: 'DIAGNOSIS',
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
                type: 'SICKNESS_REPORTED',
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
                type: record.sicknessId ? 'TREATMENT_ADMINISTERED' : 'PREVENTIVE_TREATMENT',
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
                type: 'VACCINATION',
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
                type: 'TASK_CREATED',
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
                type: 'TASK_OBSERVATION',
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
                type: 'OFFTAKE',
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
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Livestock activity timeline retrieved successfully', {
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
    }
    catch (error) {
        next(error);
    }
};
exports.getLivestockActivityTimeline = getLivestockActivityTimeline;
