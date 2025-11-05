import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { userSelect } from '../prisma/selects';
import { ForbiddenError } from '../errors/ForbiddenError';
import { Role } from '@prisma/client';
import { normalizePhoneNumber, validatePhoneNumber } from '../utils/phoneFormat';
import { BadRequestError } from '../errors/BadRequestError';
// import { Prisma } from '@prisma/client';

export const getProfile = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: (req.user as any).id },
			select: userSelect 
		});

		if (!user) throw new NotFoundError('User not found');

		// user.password = '';
		sendSuccessResponse(res, 'Profile successfully retrieved', user);
	} catch (error) {
		next(error);
	}
};

// export const updateProfile = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = (req.user as any).id;
//     const { fullName, location, avatar, phone } = req.body;

//     if (phone && !validatePhoneNumber(phone)) {
//       throw new BadRequestError(
//         'Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)'
//       );
//     }

//     const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;


//     const updatedUser = await prisma.user.update({
//       where: { id: userId },
//       data: { fullName, location, avatar, phone:normalizedPhone },
//       select: userSelect
//     });

//     sendSuccessResponse(res, 'Profile updated successfully', updatedUser);
//   } catch (error) {
//     next(error);
//   }
// };

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const requestingUser = (req as any).user; // Get the current user
    const { page = 1, limit = 10 } = req.query;

    // Determine which roles the current user can access
    let allowedRoles: Role[] = [];
    
    if (requestingUser.role === 'ADMIN') {
      allowedRoles = ['FARM_KEEPER', 'COWORKER'];
    } else if (requestingUser.role === 'FARM_KEEPER') {
      allowedRoles = ['COWORKER'];
    } else {
      throw new ForbiddenError('You do not have permission to view users');
    }

    const where = {
      role: { in: allowedRoles },
      id: { not: requestingUser.id } // Exclude the current user
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: userSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where })
    ]);

    sendSuccessResponse(res, 'Users retrieved successfully', {
      users,
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


export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: userSelect
    });

    if (!user) throw new NotFoundError('User not found');
    sendSuccessResponse(res, 'User retrieved successfully', user);
  } catch (error) {
    next(error);
  }
};


export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
	const user = await prisma.user.findUnique({
		where: {id: req.params.userId}
	});
	
	if (!user) throw new NotFoundError('User not found');

    await prisma.user.delete({
      where: { id: req.params.userId },
    });

    sendSuccessResponse(res, 'User permanently deleted successfully');
  } catch (error) {
    next(error);
  }
};


export const updateUserProfile = async (
   req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const { fullName, location, avatar, phone, companyName } = req.body;

    // Validate phone if provided
    if (phone && !validatePhoneNumber(phone)) {
      throw new BadRequestError(
        'Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)'
      );
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    // Prepare update data
    const updateData: any = {
      fullName,
      location,
      avatar,
      phone: normalizedPhone,
    };

    // Only allow admin to update companyName
    if (companyName && userRole === 'ADMIN') {
      updateData.companyName = companyName;
    } else if (companyName && userRole !== 'ADMIN') {
      throw new ForbiddenError('Only admin can update company name');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: userSelect
    });

    sendSuccessResponse(res, 'Profile updated successfully', updatedUser);
  } catch (error) {
    next(error);
  }
};


export const adminUpdateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = (req.user as any).id;
    const adminRole = (req.user as any).role;
    const { userId } = req.params;
    const { fullName, location, avatar, phone, companyName, role, isSuspended } = req.body;

    // Check if user is admin
    if (adminRole !== 'ADMIN') {
      throw new ForbiddenError('Only admin can update other users');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }
    if (phone && !validatePhoneNumber(phone)) {
      throw new BadRequestError(
        'Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)'
      );
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    // Prepare update data
    const updateData: any = {
      ...(fullName && { fullName }),
      ...(location && { location }),
      ...(avatar && { avatar }),
      ...(phone && { phone: normalizedPhone }),
      ...(companyName && { companyName }),
      ...(role && { role }),
      ...(isSuspended !== undefined && { isSuspended }),
    };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: userSelect
    });

    sendSuccessResponse(res, 'User updated successfully', updatedUser);
  } catch (error) {
    next(error);
  }
};


export const getVetAssignedFarms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const vetId = (req.user as any).id;
    const vetRole = (req.user as any).role;

    // Only vets can access this endpoint
    if (vetRole !== 'VET') {
      throw new ForbiddenError('Only vets can access assigned farms');
    }

    // Get distinct companies where the vet has tasks
    const assignedCompanies = await prisma.task.findMany({
      where: {
        assignedToId: vetId,
        assignedBy: {
          companyName: { not: null }
        }
      },
      distinct: ['assignedById'],
      include: {
        assignedBy: { select: userSelect }
      },
      orderBy: {
        assignedBy: {
          companyName: 'asc'
        }
      }
    });

    // Extract unique companies
    const companies = assignedCompanies
      .map(task => task.assignedBy)
      .filter((company, index, self) => 
        index === self.findIndex(c => c.companyName === company.companyName)
      );

    sendSuccessResponse(res, 'Assigned farms retrieved successfully', {
      companies,
      total: companies.length
    });
  } catch (error) {
    next(error);
  }
};


export const getFarmDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const vetId = (req.user as any).id;
    const vetRole = (req.user as any).role;
    const { companyId } = req.params;

    // Only vets can access this endpoint
    if (vetRole !== 'VET') {
      throw new ForbiddenError('Only vets can access farm details');
    }

    // Verify the vet has tasks from this company
    const hasAccess = await prisma.task.findFirst({
      where: {
        assignedToId: vetId,
        assignedById: companyId
      }
    });

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this farm');
    }

    // Get company admin details
    const companyAdmin = await prisma.user.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        companyName: true,
        location: true,
        avatar: true,
        createdAt: true
      }
    });

    if (!companyAdmin) {
      throw new NotFoundError('Farm not found');
    }

    // Get farm staff (excluding coworkers for privacy)
    const farmStaff = await prisma.user.findMany({
      where: {
        companyName: companyAdmin.companyName,
        role: { in: ['ADMIN', 'FARM_KEEPER'] },
        id: { not: companyId } // Exclude the admin we already have
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        email: true,
        location: true,
        avatar: true,
        lastLogin: true
      },
      orderBy: { role: 'asc' }
    });

    // Get livestock statistics
    const livestockStats = await prisma.livestock.aggregate({
      where: {
        addedBy: {
          companyName: companyAdmin.companyName
        },
        isDeleted: false
      },
      _count: {
        id: true
      },
      _avg: {
        weight: true
      }
    });

    // Get livestock by health status
    const livestockByHealth = await prisma.livestock.groupBy({
      by: ['healthStatus'],
      where: {
        addedBy: {
          companyName: companyAdmin.companyName
        },
        isDeleted: false
      },
      _count: {
        id: true
      }
    });

    // Get recent sickness cases
    const recentSickness = await prisma.sickness.findMany({
      where: {
        livestock: {
          addedBy: {
            companyName: companyAdmin.companyName
          }
        }
      },
      include: {
        livestock: {
          select: {
            id: true,
            tagId: true,
            type: true,
            breed: true
          }
        },
        recordedBy: { select: userSelect },
        treatments: {
          orderBy: { dateOfTreatment: 'desc' },
          take: 1,
          include: {
            recordedBy: { select: userSelect }
          }
        }
      },
      orderBy: { dateOfObservation: 'desc' },
      take: 10
    });

    // Get upcoming vaccinations
    const upcomingVaccinations = await prisma.vaccination.findMany({
      where: {
        livestock: {
          addedBy: {
            companyName: companyAdmin.companyName
          }
        },
        nextDueDate: {
          gte: new Date()
        }
      },
      include: {
        livestock: {
          select: {
            id: true,
            tagId: true,
            type: true
          }
        },
        recordedBy: { select: userSelect }
      },
      orderBy: { nextDueDate: 'asc' },
      take: 10
    });

    // Get active tasks for this farm
    const activeTasks = await prisma.task.findMany({
      where: {
        assignedToId: vetId,
        assignedById: companyId,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      include: {
        livestock: {
          select: {
            id: true,
            tagId: true,
            type: true,
            healthStatus: true
          }
        }
      },
      orderBy: { dueDate: 'asc' },
      take: 10
    });

    const farmDetails = {
      company: companyAdmin,
      staff: farmStaff,
      statistics: {
        totalLivestock: livestockStats._count.id,
        averageWeight: livestockStats._avg.weight,
        healthBreakdown: livestockByHealth
      },
      recentSickness,
      upcomingVaccinations,
      activeTasks
    };

    sendSuccessResponse(res, 'Farm details retrieved successfully', farmDetails);
  } catch (error) {
    next(error);
  }
};