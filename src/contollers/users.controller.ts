import { NextFunction, Request, Response } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { BadRequestError } from '../errors/BadRequestError';
import { deleteFile, STORAGE_CONTAINERS, uploadToAzure } from '../config/upload';
import { logActivity } from './activity.controller';
import { userSelect } from '../prisma/selects';
import { CreditTransactionStatus, CreditTransactionType, Role } from '@prisma/client';
import { UserService } from '../services/user.service';
import { attachBaseUrlUploads } from '../utils/attachBaseUrl.utils';
import { serializeDates } from '../utils/serialize.utils';
import Logger from '@/config/logger';



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


export const adminUpdateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminUser = req.user as any;
    const { userId } = req.params;
    const { fullName, phone, location, role, isSuspended, isVerified } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId as string },
    });

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    if (userId === adminUser.id && role && role !== 'ADMIN') {
      throw new BadRequestError('You cannot change your own role');
    }

    if (targetUser.role === 'ADMIN' && adminUser.id !== userId) {
      throw new ForbiddenError('Cannot modify other admin accounts');
    }

    // Build update data
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (location !== undefined) updateData.location = location;
    if (role !== undefined) updateData.role = role;
    if (isSuspended !== undefined) updateData.isSuspended = isSuspended;
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    const updatedUser = await prisma.user.update({
      where: { id: userId as string },
      data: updateData,
      select: userSelect,
    });

    await logActivity(
      adminUser.id,
      'ADMIN_UPDATE_USER',
      'USER',
      userId as string,
      {
        targetUserEmail: targetUser.email,
        updates: Object.keys(updateData),
      },
      req
    );

    sendSuccessResponse(res, 'User updated successfully', {
      user: updatedUser,
    });
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


export const selfDeleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { password, reason, confirmationPhrase } = req.body;

    const result = await UserService.selfDeleteAccount(user.id, {
      password,
      reason,
      confirmationPhrase,
    });

    await logActivity(
      user.id,
      'SELF_DELETE_ACCOUNT',
      'USER',
      user.id,
      {
        originalEmail: result.originalEmail,
        reason: reason || 'User requested account deletion',
        creditPointsLost: result.creditPointsLost,
      },
      req
    );

    sendSuccessResponse(
      res,
      "Your account has been deleted successfully. We're sorry to see you go.",
      {
        deletedAt: result.user.deletedAt,
      }
    );
  } catch (error) {
    next(error);
  }
};

// export const getDeletionInfo = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = req.user as any;

//     const info = await UserService.getDeletionInfo(user.id);

//     sendSuccessResponse(
//       res,
//       "Deletion info retrieved successfully",
//       info
//     );
//   } catch (error) {
//     next(error);
//   }



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

    // console.log('Avatar upload details:', {
    //   originalname: file.originalname,
    //   mimetype: file.mimetype,
    //   size: file.size,
    //   key: (file as any).key,
    //   location: (file as any).location,
    // });
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });
    if (!currentUser) {
      throw new BadRequestError("User not found");
    }

    const driver = process.env.STORAGE_DRIVER || 'local';
    const container = STORAGE_CONTAINERS.USER_AVATARS;
    let avatarUrl: string;

    if (driver === 'azure') {
      avatarUrl = await uploadToAzure(file, container);
    } else if (driver === 's3') {
      const s3File = file as any;
      avatarUrl = s3File.location || `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3File.key}`;
    } else {
      avatarUrl = `/uploads/${file.filename}`;
    }

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

    const oldAvatarUrl = currentUser.avatar;
    if (
      oldAvatarUrl &&
      !oldAvatarUrl.includes('randomuser.me') &&
      !oldAvatarUrl.includes('ui-avatars')
    ) {
      try {
        if (driver === 's3') {
          const parsedUrl = new URL(oldAvatarUrl);

          const oldKey = decodeURIComponent(
            parsedUrl.pathname.replace(/^\/+/, '')
          );
          if (oldKey.startsWith(`${STORAGE_CONTAINERS.USER_AVATARS}/`)) {
            await deleteFile(oldKey, container);
            console.log('Previous avatar deleted from S3:', oldKey);
          } else {
            console.warn(
              'Skipping deletion: avatar is outside user-avatars/',
              oldKey
            );
          }
        } else {
          const oldKey = oldAvatarUrl.split('/').pop();

          if (oldKey) {
            await deleteFile(oldKey, container);
          }
        }
      } catch (err) {
        console.error('Failed to delete previous avatar:', err);
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

export const getUserDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    const dashboardData = await UserService.getUserDashboardStats(user.id);
    const dataWithUrls = attachBaseUrlUploads(
      serializeDates(dashboardData),
      req
    );

    await logActivity(
      user.id,
      'VIEW_USER_DASHBOARD',
      'DASHBOARD',
      'user',
      {
        savedProperties: dashboardData.userStats.savedProperties,
        activeInquiries: dashboardData.userStats.activeInquiries
      },
      req
    );

    sendSuccessResponse(res, "User dashboard retrieved successfully", dataWithUrls);
  } catch (error) {
    next(error);
  }
};


export const getUserInquiriesStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    const stats = await UserService.getUserInquiriesStats(user.id);

    await logActivity(
      user.id,
      'VIEW_USER_INQUIRIES_STATS',
      'INQUIRY',
      'stats',
      {
        total: stats.stats.total,
        pending: stats.stats.pending,
        completed: stats.stats.completed
      },
      req
    );

    sendSuccessResponse(res, "User inquiries statistics retrieved successfully", stats);
  } catch (error) {
    next(error);
  }
};


export const completeInquiry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { inquiryId } = req.params;
    const { satisfactionStatus, satisfactionComment } = req.body;

    const inquiry = await UserService.completeInquiry(
      inquiryId as string,
      user.id,
      { satisfactionStatus, satisfactionComment }
    );

    await logActivity(
      user.id,
      'COMPLETE_INQUIRY',
      'INQUIRY',
      inquiryId as string,
      {
        inquiryNumber: inquiry.inquiryNumber,
        satisfactionStatus: inquiry.satisfactionStatus, 
        propertyName: inquiry.property.name,
        status: inquiry.status
      },
      req
    );

    sendSuccessResponse(res, "Inquiry marked as completed successfully", inquiry);
  } catch (error) {
    next(error);
  }
};


export const switchRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { role } = req.body as { role: 'USER' | 'VENDOR' };
    const dbUser = await UserService.validateRoleSwitch(user.id, role);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: role === 'VENDOR' ? Role.VENDOR : Role.USER },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        ninVerificationStatus: true,
        creditPoints: true,
      },
    });
    let welcomeBonus: { points: number; grantId: string } | null = null;
    if (dbUser.role === Role.USER && role === 'VENDOR') {
      const alreadyGotBonus = await prisma.creditTransaction.findFirst({
        where: {
          userId: user.id,
          type: CreditTransactionType.ADMIN_ADJUSTMENT,
          OR: [
            { description: { startsWith: 'Welcome bonus for new vendor' } },
            {
              metadata: {
                path: ['isWelcomeBonus'],
                equals: true,
              },
            },
          ],
        },
      });

      if (!alreadyGotBonus) {
        const settings = await prisma.creditPointSettings.findFirst({
          where: { isActive: true },
        });

        const bonusPoints = settings?.newVendorBonusPoints ?? 0;

        if (bonusPoints > 0) {
          const expiresAt = settings?.newVendorBonusExpiryDays
            ? new Date(
                Date.now() +
                  settings.newVendorBonusExpiryDays * 24 * 60 * 60 * 1000
              )
            : null;

          const grantId = `WLCM-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;

          const result = await prisma.$transaction(async (tx) => {
            const balanceBefore = updatedUser.creditPoints;
            const balanceAfter = balanceBefore + bonusPoints;

            await tx.user.update({
              where: { id: user.id },
              data: {
                creditPoints: balanceAfter,
                creditPointsPurchased: { increment: bonusPoints },
              },
            });

            const transaction = await tx.creditTransaction.create({
              data: {
                transactionNumber: `CRT-${Date.now()}-${Math.random()
                  .toString(36)
                  .substring(2, 8)}`,
                userId: user.id,
                type: CreditTransactionType.ADMIN_ADJUSTMENT,
                status: CreditTransactionStatus.COMPLETED,
                points: bonusPoints,
                balanceBefore,
                balanceAfter,
                description: `Welcome bonus for new vendor (${bonusPoints} points)`,
                metadata: {
                  isWelcomeBonus: true,
                  grantId,
                  grantedBy: 'system',
                  trigger: 'first_vendor_switch',
                },
                expiresAt,
              },
            });

            return { transaction, balanceAfter };
          });

          welcomeBonus = {
            points: bonusPoints,
            grantId,
          };

          // Reflect the new balance in the response snapshot
          updatedUser.creditPoints = result.balanceAfter;

          Logger.info(
            `Welcome bonus awarded to ${dbUser.email} on first vendor switch: ${bonusPoints} points`
          );
        }
      }
    }

    // 4. In-app notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'GENERAL',
        title: 'Account Role Updated',
        message: `Your account role was changed from ${dbUser.role} to ${role}.${
          welcomeBonus
            ? ` A welcome bonus of ${welcomeBonus.points} credit points has been added.`
            : ''
        } All your data has been preserved.`,
        data: {
          previousRole: dbUser.role,
          newRole: role,
          ...(welcomeBonus && { welcomeBonus }),
        },
      },
    });

    // 5. Activity log
    await logActivity(
      user.id,
      'SWITCH_ROLE',
      'USER',
      user.id,
      {
        previousRole: dbUser.role,
        newRole: role,
        ...(welcomeBonus && { welcomeBonus }),
      },
      req
    );

    sendSuccessResponse(
      res,
      `Role switched to ${role.toLowerCase()} successfully`,
      {
        user: updatedUser,
        ...(welcomeBonus && { welcomeBonus }),
      }
    );
  } catch (error) {
    next(error);
  }
};