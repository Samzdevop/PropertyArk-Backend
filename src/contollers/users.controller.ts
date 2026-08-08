import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { BadRequestError } from '../errors/BadRequestError';
import { deleteFile, STORAGE_CONTAINERS, uploadToAzure } from '../config/upload';
import { logActivity } from './activity.controller';
import { userSelect } from '../prisma/selects';
import { Role } from '@prisma/client';
import { UserService } from '../services/user.service';



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
		sendSuccessResponse(res, 'Profile successfully retrieved', user);
	} catch (error) {
		next(error);
	}
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { fullName, phone, location, avatar } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) throw new NotFoundError('User not found');

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        phone,
        location,
        avatar
      },
      select: userSelect
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE_PROFILE',
        entityType: 'USER',
        entityId: userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    sendSuccessResponse(res, 'Profile successfully updated', {updatedUser});
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {   
	const requestingUser = (req as any).user;
	const {page = 1, limit = 10, role } = req.query;

	let allowedRoles: Role[] = [];

	// if(requestingUser.role === 'ADMIN'){
	// 	allowedRoles = ['VENDOR', 'USER', 'STAFF'];
	// }else {
	// 	throw new ForbiddenError('You don not have permission to view users');
	// }

   if (requestingUser.role === 'ADMIN') {
      if (role) {
        const validRoles = ['VENDOR', 'USER', 'STAFF'];
        if (!validRoles.includes(role as string)) {
          throw new BadRequestError(`Invalid role. Allowed: ${validRoles.join(', ')}`);
        }
        allowedRoles = [role as Role];
      } else {
        allowedRoles = ['VENDOR', 'USER', 'STAFF'];
      }
    } else {
      throw new ForbiddenError('You do not have permission to view users');
    }


	const where = {
		role: {in: allowedRoles},
		id: {not: requestingUser.id}
	};

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where: {
				role: { in: allowedRoles },
        id: { not: requestingUser.id }
			},
			skip: (Number(page) - 1) * Number(limit),
			take: Number(limit),
			select:userSelect,
			orderBy: { createdAt: 'desc'},
		}),
		prisma.user.count({where})
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



// export const deleteUser = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = req.params.userId;

//     const user = await prisma.user.findUnique({
//       where: { id: userId as string },
//     });

//     if (!user) throw new NotFoundError("User not found");

//     await prisma.$transaction(async (tx) => {
//       await tx.document.deleteMany({
//         where: {
//           uploadedById: userId as string,
//         },
//       });

//       await tx.user.delete({
//         where: {
//           id: userId as string,
//         },
//       });
//     });

//     res.status(204).end();
//   } catch (error) {
//     next(error);
//   }
// };



export const deleteUser = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
    const user = await prisma.user.findUnique({
      where: {id: req.params.userId as string}
    });
    if (!user) throw new NotFoundError('User not found');

	  await prisma.user.delete({ 
      where: { id: req.params.userId as string }
    });
		// console.log({ user });
		res.status(204).end();
	} catch (error) {
		next(error);
	}
};




export const updateAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const file = req.file;

    if (!file) {
      throw new BadRequestError("No file uploaded");
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    const container = STORAGE_CONTAINERS.USER_AVATARS;
    const avatarUrl = process.env.STORAGE_DRIVER === 'azure'
      ? await uploadToAzure(file, container)
      : `/uploads/${file.filename}`;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatar: true
      }
    });

    if (currentUser?.avatar && !currentUser.avatar.includes('randomuser.me') && !currentUser.avatar.includes('ui-avatars')) {
      const oldKey = currentUser.avatar.split('/').pop();
      if (oldKey) {
        await deleteFile(oldKey, container).catch(err => 
          console.error('Failed to delete old avatar:', err)
        );
      }
    }

    await logActivity(
      userId,
      'UPDATE_AVATAR',
      'USER',
      userId,
      { avatarUrl },
      req
    );

    sendSuccessResponse(res, "Avatar updated successfully", updatedUser);
  } catch (error) {
    next(error);
  }
};



export const removeAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any).id;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    if (currentUser?.avatar && !currentUser.avatar.includes('randomuser.me') && !currentUser.avatar.includes('ui-avatars')) {
      const container = STORAGE_CONTAINERS.USER_AVATARS;
      const oldKey = currentUser.avatar.split('/').pop();
      if (oldKey) {
        await deleteFile(oldKey, container).catch(err => 
          console.error('Failed to delete avatar:', err)
        );
      }
    }

   
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatar: true
      }
    });

    await logActivity(
      userId,
      'REMOVE_AVATAR',
      'USER',
      userId,
      {},
      req
    );

    sendSuccessResponse(res, "Avatar removed successfully", updatedUser);
  } catch (error) {
    next(error);
  }
};


export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { currentPassword, newPassword } = req.body;

    await UserService.changePassword(user.id, currentPassword, newPassword);

    await logActivity(
      user.id,
      "CHANGE_PASSWORD",
      "USER",
      user.id,
      {
        action: "Password changed successfully",
        timestamp: new Date().toISOString(),
      },
      req
    );

    sendSuccessResponse(res, "Password changed successfully");
  } catch (error) {
    next(error);
  }
};

