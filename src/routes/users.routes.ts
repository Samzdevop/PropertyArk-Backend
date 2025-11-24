import { Router } from 'express';
import {
	deleteUser,
	getAllUsers,
	getProfile,
	// updateProfile,
	getUserById,
	updateUserProfile,
	adminUpdateUser,
	getFarmDetails,
	getVetAssignedFarms,
} from '../contollers/users.controllers';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { adminUpdateUserSchema, changePasswordSchema, updateUserSchema } from '../schemas/users.schemas';
import { requireRoles } from '../middlewares/roleCheck';

export const usersRouter = Router();

usersRouter.get(
	'/profile', 
	authenticateJWT, 
	getProfile
);

usersRouter.patch(
  '/update',
  authenticateJWT,
  validateRequest(updateUserSchema),
  updateUserProfile
);

// usersRouter.patch(
// 	'/update',
// 	authenticateJWT,
// 	validateRequest(updateUserSchema),
// 	updateProfile
// );
 
usersRouter.get(
	'/', 
	authenticateJWT,
	requireRoles(['ADMIN', 'FARM_KEEPER']),
	getAllUsers
);

usersRouter.get(
	'/:userId',
	authenticateJWT,
	requireRoles(['ADMIN', 'FARM_KEEPER']),
	getUserById
);

usersRouter.delete(
	'/:userId', 
	authenticateJWT,
	requireRoles(['ADMIN', 'FARM_KEEPER']),
	deleteUser
);


usersRouter.patch(
  '/:userId',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(adminUpdateUserSchema),
  adminUpdateUser
);

usersRouter.get(
	'/vet/assigned-farms', 
	authenticateJWT,
	requireRoles(['VET']),
	getVetAssignedFarms
);

usersRouter.get(
	'/vet/farms/:companyId',
	authenticateJWT,
	requireRoles(['VET']),
	getFarmDetails
);

