import { Router } from 'express';
import { authenticateJWT } from '../middlewares/errorHandler.middleware';
import { validateRequest } from '../middlewares/validateRequest.middleware';
import { changePasswordSchema, updateUserSchema } from '../schemas/users.schemas';
import { requireRoles } from '../middlewares/roleCheck.middleware';
import { changePassword, deleteUser, getAllUsers, getProfile } from '../contollers/users.controller';

export const usersRouter = Router();

usersRouter.get(
	'/profile', 
	authenticateJWT, 
	getProfile
);

usersRouter.patch(
	'/change-password',
	authenticateJWT,
	validateRequest(changePasswordSchema),
	changePassword
);
 
usersRouter.get(
	'/', 
	authenticateJWT,
	requireRoles(['ADMIN']),
	getAllUsers
);

// usersRouter.get(
// 	'/:userId',
// 	authenticateJWT,
// 	requireRoles(['ADMIN']),
// 	getUserById
// );

usersRouter.delete(
	'/:userId', 
	authenticateJWT,
	requireRoles(['ADMIN']),
	deleteUser
);
