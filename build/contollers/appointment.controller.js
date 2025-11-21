"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFarmVisits = exports.logFarmVisit = exports.getAppointments = exports.scheduleAppointment = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const appointment_helpers_1 = require("../helpers/appointment.helpers");
const NotFoundError_1 = require("../errors/NotFoundError");
const scheduleAppointment = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const companyId = req.params.companyId;
        if (userRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only veterinarians can schedule appointments');
        }
        const company = await prisma_1.default.company.findUnique({
            where: { id: companyId }
        });
        if (!company) {
            throw new NotFoundError_1.NotFoundError('Company not found');
        }
        const { visitType, title, date, time, relatedFarm, relatedAnimal, purpose, setReminder, notifyFarmStaff } = req.body;
        // Combine date and time
        const dateTime = new Date(`${date}T${time}`);
        const appointment = await prisma_1.default.appointment.create({
            data: {
                companyId: company.id,
                visitType,
                title,
                date: dateTime,
                time: dateTime,
                relatedFarm,
                relatedAnimal,
                purpose,
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
                }
            }
        });
        // Create reminders if set
        if (setReminder) {
            await (0, appointment_helpers_1.createAppointmentReminders)(appointment);
        }
        // Notify farm staff if requested
        if (notifyFarmStaff) {
            await (0, appointment_helpers_1.notifyFarmStaffAboutAppointment)(appointment, companyId);
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Appointment scheduled successfully', {
            appointment
        }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.scheduleAppointment = scheduleAppointment;
const getAppointments = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { page = 1, limit = 10, status, visitType } = req.query;
        const where = {};
        // Vets see their own appointments, Admins/Farm Keepers see appointments for their farm
        if (userRole === 'VET') {
            where.recordedById = userId;
        }
        else {
            // For farm staff, show appointments for their farm
            const user = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: { companyName: true }
            });
            if (user?.companyName) {
                where.relatedFarm = user.companyName;
            }
        }
        if (status)
            where.status = String(status);
        if (visitType)
            where.visitType = String(visitType);
        const [appointments, total] = await Promise.all([
            prisma_1.default.appointment.findMany({
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
                orderBy: { date: 'asc' }
            }),
            prisma_1.default.appointment.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Appointments retrieved successfully', {
            appointments,
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
exports.getAppointments = getAppointments;
// export const logFarmVisit = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = (req.user as any).id;
//     const userRole = (req.user as any).role;
//     const companyId = req.params.companyId;
//     // Only VET can log farm visits
//     if (userRole !== 'VET') {
//       throw new ForbiddenError('Only veterinarians can log farm visits');
//     }
//     const {
//       relatedFarm,
//       date,
//       time,
//       reason,
//       keyPersonnelMet,
//       animalExamined,
//       farmObservation,
//       farmRecommendation,
//       mediaUrls
//     } = req.body;
//     // Combine date and time
//     const dateTime = new Date(`${date}T${time}`);
//     const farmVisit = await prisma.farmVisit.create({
//       data: {
//         companyId,
//         relatedFarm,
//         date: dateTime,
//         time: dateTime,
//         reason,
//         keyPersonnelMet,
//         animalExamined,
//         farmObservation,
//         farmRecommendation,
//         mediaUrls: mediaUrls || [],
//         recordedById: userId
//       },
//       include: {
//         recordedBy: {
//           select: {
//             id: true,
//             fullName: true,
//             role: true
//           }
//         }
//       }
//     });
//     sendSuccessResponse(res, 'Farm visit logged successfully', { 
//       farmVisit 
//     }, 201);
//   } catch (error) {
//     next(error);
//   }
// };
const logFarmVisit = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const companyId = req.params.companyId;
        // Only VET can log farm visits
        if (userRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only veterinarians can log farm visits');
        }
        const { relatedFarm, date, time, reason, keyPersonnelMet, animalExamined, farmObservation, farmRecommendation, mediaUrls } = req.body;
        // Combine date and time
        const dateTime = new Date(`${date}T${time}`);
        const farmVisit = await prisma_1.default.farmVisit.create({
            data: {
                companyId,
                relatedFarm,
                date: dateTime,
                time: dateTime,
                reason,
                keyPersonnelMet,
                animalExamined,
                farmObservation,
                farmRecommendation,
                mediaUrls: mediaUrls || [],
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
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Farm visit logged successfully', {
            farmVisit // Removed trailing comma here
        }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.logFarmVisit = logFarmVisit;
const getFarmVisits = async (req, res, next) => {
    try {
        const companyId = req.params.companyId;
        const { page = 1, limit = 10 } = req.query;
        const [farmVisits, total] = await Promise.all([
            prisma_1.default.farmVisit.findMany({
                where: { companyId },
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
            prisma_1.default.farmVisit.count({ where: { companyId } })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Farm visits retrieved successfully', {
            farmVisits,
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
exports.getFarmVisits = getFarmVisits;
