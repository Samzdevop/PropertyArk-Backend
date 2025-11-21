import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { ForbiddenError } from '../errors/ForbiddenError';
import { createAppointmentReminders, notifyFarmStaffAboutAppointment } from '../helpers/appointment.helpers';
import { NotFoundError } from '../errors/NotFoundError';

export const scheduleAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const companyId = req.params.companyId;
    if (userRole !== 'VET') {
      throw new ForbiddenError('Only veterinarians can schedule appointments');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new NotFoundError('Company not found');
    }

    const {
      visitType,
      title,
      date,
      time,
      relatedFarm,
      relatedAnimal,
      purpose,
      setReminder,
      notifyFarmStaff
    } = req.body;

    // Combine date and time
    const dateTime = new Date(`${date}T${time}`);

    const appointment = await prisma.appointment.create({
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
      await createAppointmentReminders(appointment);
    }

    // Notify farm staff if requested
    if (notifyFarmStaff) {
      await notifyFarmStaffAboutAppointment(appointment, companyId);
    }

    sendSuccessResponse(res, 'Appointment scheduled successfully', { 
      appointment 
    }, 201);
  } catch (error) {
    next(error);
  }
};
         
export const getAppointments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const { page = 1, limit = 10, status, visitType } = req.query;

    const where: any = {};

    // Vets see their own appointments, Admins/Farm Keepers see appointments for their farm
    if (userRole === 'VET') {
      where.recordedById = userId;
    } else {
      // For farm staff, show appointments for their farm
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyName: true }
      });
      if (user?.companyName) {
        where.relatedFarm = user.companyName;
      }
    }

    if (status) where.status = String(status);
    if (visitType) where.visitType = String(visitType);

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
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
      prisma.appointment.count({ where })
    ]);

    sendSuccessResponse(res, 'Appointments retrieved successfully', {
      appointments,
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


export const logFarmVisit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const companyId = req.params.companyId;

    // Only VET can log farm visits
    if (userRole !== 'VET') {
      throw new ForbiddenError('Only veterinarians can log farm visits');
    }

    const {
      relatedFarm,
      date,
      time,
      reason,
      keyPersonnelMet,
      animalExamined,
      farmObservation,
      farmRecommendation,
      mediaUrls
    } = req.body;

    // Combine date and time
    const dateTime = new Date(`${date}T${time}`);

    const farmVisit = await prisma.farmVisit.create({
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

    sendSuccessResponse(res, 'Farm visit logged successfully', { 
      farmVisit  // Removed trailing comma here
    }, 201);
  } catch (error) {
    next(error);
  }
};




export const getFarmVisits = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.params.companyId;
    const { page = 1, limit = 10 } = req.query;

    const [farmVisits, total] = await Promise.all([
      prisma.farmVisit.findMany({
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
      prisma.farmVisit.count({ where: { companyId } })
    ]);

    sendSuccessResponse(res, 'Farm visits retrieved successfully', {
      farmVisits,
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