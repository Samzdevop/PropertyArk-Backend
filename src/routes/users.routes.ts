import { Router } from 'express';
import { authenticateJWT } from '../middlewares/errorHandler.middleware';
import { validateRequest } from '../middlewares/validateRequest.middleware';
import { changePasswordSchema, completeInquirySchema, selfDeleteAccountSchema, updateUserSchema } from '../schemas/users.schemas';
import { requireRoles } from '../middlewares/roleCheck.middleware';
import { adminUpdateUser, changePassword, completeInquiry, deleteUser, getAllUsers, getProfile, getUserDashboard, getUserInquiriesStats, removeAvatar, selfDeleteAccount, updateAvatar, updateProfile } from '../contollers/users.controller';
import { uploadAvatar } from '../config/upload';

export const usersRouter = Router();

usersRouter.get(
	'/profile', 
	authenticateJWT, 
	getProfile
);


usersRouter.patch(
  '/update',                    // ← Explicit route
  authenticateJWT,
  validateRequest(updateUserSchema),
  updateProfile
);


usersRouter.patch(
	'/change-password',
	authenticateJWT,
	validateRequest(changePasswordSchema),
	changePassword
);
 

usersRouter.patch(
	'/avatar',
	authenticateJWT, 
	uploadAvatar.single('avatar'),
	updateAvatar
);
usersRouter.delete(
	'/avatar',
	authenticateJWT, 
	removeAvatar
);

usersRouter.get(
  '/dashboard',
  authenticateJWT,
  requireRoles(['USER']),
  getUserDashboard
);

usersRouter.get(
  '/inquiries/stats',
  authenticateJWT,
  requireRoles(['USER']),
  getUserInquiriesStats
);


usersRouter.patch(
  '/:inquiryId/complete',
  authenticateJWT,
  requireRoles(['USER']),
  validateRequest(completeInquirySchema),
  completeInquiry
);

usersRouter.delete(
  '/account',
  authenticateJWT,
  validateRequest(selfDeleteAccountSchema),
  selfDeleteAccount
);


usersRouter.get(
	'/', 
	authenticateJWT,
	requireRoles(['ADMIN']),
	getAllUsers
);

usersRouter.patch(
  '/:userId',
  authenticateJWT, 
  requireRoles(['ADMIN']),
  adminUpdateUser    
);

usersRouter.delete(
	'/:userId', 
	authenticateJWT,
	requireRoles(['ADMIN']),
	deleteUser
);
