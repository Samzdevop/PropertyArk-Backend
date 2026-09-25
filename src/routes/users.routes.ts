import { Router } from 'express';
import { authenticateJWT } from '../middlewares/errorHandler.middleware';
import { validateRequest } from '../middlewares/validateRequest.middleware';
import { changePasswordSchema, completeInquirySchema } from '../schemas/users.schemas';
import { requireRoles } from '../middlewares/roleCheck.middleware';
import { changePassword, completeInquiry, deleteUser, getAllUsers, getProfile, getUserDashboard, getUserInquiriesStats, removeAvatar, updateAvatar, updateProfile } from '../contollers/users.controller';
import { uploadAvatar } from '@/config/upload';

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

usersRouter.get(
  '/dashboard',
  authenticateJWT,
  requireRoles(['USER']),
  getUserDashboard
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

// Get user inquiries statistics
usersRouter.get(
  '/inquiries/stats',
  authenticateJWT,
  requireRoles(['USER']),
  getUserInquiriesStats
);

// Complete inquiry (only when status is ACCEPTED)
usersRouter.patch(
  '/:inquiryId/complete',
  authenticateJWT,
  requireRoles(['USER']),
  validateRequest(completeInquirySchema),
  completeInquiry
);

usersRouter.patch(
	'/:userId',
	authenticateJWT, 
	requireRoles(['ADMIN']),
	updateProfile
);

usersRouter.delete(
	'/:userId', 
	authenticateJWT,
	requireRoles(['ADMIN']),
	deleteUser
);
