"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleFollowUp = exports.prescribeTreatment = exports.getTreatmentById = exports.getAllTreatments = exports.recordTreatment = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const selects_1 = require("../prisma/selects");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const treatment_helpers_1 = require("../helpers/treatment.helpers");
const recordTreatment = async (req, res, next) => {
    try {
        const { dateOfTreatment, treatmentType, dosage, cause, administeredBy, nextDueDate } = req.body;
        const livestockId = req.params.livestockId;
        const sicknessId = req.params.sicknessId; // Optional
        const recordedById = req.user.id;
        // Verify livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
            where: { id: livestockId }
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        // Verify sickness exists if provided
        if (sicknessId) {
            const sickness = await prisma_1.default.sickness.findUnique({
                where: { id: sicknessId }
            });
            if (!sickness)
                throw new NotFoundError_1.NotFoundError('Sickness record not found');
        }
        // Create treatment and update livestock status in a transaction
        const [treatment] = await prisma_1.default.$transaction([
            prisma_1.default.treatment.create({
                data: {
                    livestockId,
                    sicknessId,
                    dateOfTreatment: new Date(dateOfTreatment),
                    treatmentType,
                    dosage,
                    cause,
                    administeredBy,
                    nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
                    recordedById,
                },
                include: {
                    livestock: true,
                    sickness: true,
                    recordedBy: { select: selects_1.userSelect },
                },
            }),
            prisma_1.default.livestock.update({
                where: { id: livestockId },
                data: {
                    isTreatment: true,
                    healthStatus: 'IN_TREATMENT'
                },
            }),
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Treatment successfully recorded', { treatment }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.recordTreatment = recordTreatment;
// Get all treatments
const getAllTreatments = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, livestockId, sicknessId } = req.query;
        const where = {
            ...(livestockId && { livestockId: String(livestockId) }),
            ...(sicknessId && { sicknessId: String(sicknessId) })
        };
        const treatments = await prisma_1.default.treatment.findMany({
            where,
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
            include: {
                livestock: true,
                sickness: true,
                recordedBy: { select: selects_1.userSelect }
            },
            orderBy: { dateOfTreatment: 'desc' }
        });
        const total = await prisma_1.default.treatment.count({ where });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Treatments retrieved', {
            treatments,
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
exports.getAllTreatments = getAllTreatments;
// Get single treatment
const getTreatmentById = async (req, res, next) => {
    try {
        const treatment = await prisma_1.default.treatment.findUnique({
            where: { id: req.params.treatmentId },
            include: {
                livestock: true,
                sickness: true,
                recordedBy: { select: selects_1.userSelect }
            }
        });
        if (!treatment)
            throw new NotFoundError_1.NotFoundError('Treatment record not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Treatment retrieved', { treatment });
    }
    catch (error) {
        next(error);
    }
};
exports.getTreatmentById = getTreatmentById;
const prescribeTreatment = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const livestockId = req.params.livestockId;
        // Only VET can prescribe treatments
        if (userRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only veterinarians can prescribe treatments');
        }
        const { treatmentType, medicationName, dosage, frequency, routine, additionalNotes, startDate, endDate } = req.body;
        // Verify livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
            where: {
                id: livestockId,
                isDeleted: false
            },
            include: {
                addedBy: {
                    select: {
                        id: true,
                        companyName: true
                    }
                }
            }
        });
        if (!livestock) {
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        }
        const prescribedTreatment = await prisma_1.default.prescribedTreatment.create({
            data: {
                livestockId,
                treatmentType,
                medicationName,
                dosage,
                frequency,
                routine,
                additionalNotes,
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
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
        // Create initial treatment reminders based on frequency
        await treatment_helpers_1.TreatmentHelpers.createTreatmentReminders(prescribedTreatment);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Treatment prescribed successfully', {
            prescribedTreatment
        }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.prescribeTreatment = prescribeTreatment;
const scheduleFollowUp = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        // Only VET can schedule follow-ups
        if (userRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only veterinarians can schedule follow-ups');
        }
        const { prescribedTreatmentId, reason, date, time, relatedAnimalId, relatedFarm, location, additionalNotes, setReminder, notifyFarmStaff } = req.body;
        // Verify related animal exists
        const relatedAnimal = await prisma_1.default.livestock.findUnique({
            where: {
                id: relatedAnimalId,
                isDeleted: false
            }
        });
        if (!relatedAnimal) {
            throw new NotFoundError_1.NotFoundError('Related animal not found');
        }
        // Combine date and time
        const dateTime = new Date(`${date}T${time}`);
        const followUp = await prisma_1.default.followUp.create({
            data: {
                prescribedTreatmentId: prescribedTreatmentId || null,
                reason,
                date: dateTime,
                time: dateTime,
                relatedAnimalId,
                relatedFarm,
                location,
                additionalNotes,
                setReminder,
                notifyFarmStaff,
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
                relatedAnimal: {
                    select: {
                        id: true,
                        tagId: true,
                        type: true
                    }
                },
                prescribedTreatment: {
                    select: {
                        id: true,
                        medicationName: true,
                        dosage: true
                    }
                }
            }
        });
        // Create reminders if set
        if (setReminder) {
            await treatment_helpers_1.TreatmentHelpers.createFollowUpReminders(followUp);
        }
        // Notify farm staff if requested
        if (notifyFarmStaff) {
            await treatment_helpers_1.TreatmentHelpers.notifyFarmStaffAboutFollowUp(followUp, relatedAnimal);
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Follow-up scheduled successfully', {
            followUp
        }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.scheduleFollowUp = scheduleFollowUp;
// export const getFollowUps = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { livestockId } = req.params;
//     const { page = 1, limit = 10, status } = req.query;
//     const where: any = { relatedAnimalId: livestockId };
//     if (status) where.status = String(status);
//     const [followUps, total] = await Promise.all([
//       prisma.followUp.findMany({
//         where,
//         skip: (Number(page) - 1) * Number(limit),
//         take: Number(limit),
//         include: {
//           recordedBy: {
//             select: {
//               id: true,
//               fullName: true,
//               role: true
//             }
//           },
//           relatedAnimal: {
//             select: {
//               id: true,
//               tagId: true,
//               type: true
//             }
//           },
//           prescribedTreatment: {
//             select: {
//               id: true,
//               medicationName: true,
//               treatmentType: true
//             }
//           }
//         },
//         orderBy: { date: 'asc' }
//       }),
//       prisma.followUp.count({ where })
//     ]);
//     sendSuccessResponse(res, 'Follow-ups retrieved successfully', {
//       followUps,
//       pagination: {
//         page: Number(page),
//         limit: Number(limit),
//         total,
//         pages: Math.ceil(total / Number(limit))
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };
// export const updateFollowUpStatus = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = (req.user as any).id;
//     const followUpId = req.params.followUpId;
//     const { status } = req.body;
//     const followUp = await prisma.followUp.update({
//       where: { 
//         id: followUpId
//       },
//       data: { 
//         status,
//         updatedAt: new Date()
//       },
//       include: {
//         recordedBy: {
//           select: {
//             id: true,
//             fullName: true
//           }
//         },
//         relatedAnimal: {
//           select: {
//             id: true,
//             tagId: true
//           }
//         }
//       }
//     });
//     if (!followUp) {
//       throw new NotFoundError('Follow-up not found');
//     }
//     sendSuccessResponse(res, 'Follow-up status updated successfully', { 
//       followUp 
//     });
//   } catch (error) {
//     next(error);
//   }
// };
