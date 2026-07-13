import { Router } from 'express';
import {
  adminRegister,
  forgotPassword,
  login,
  requestVerificationCode,
  resetPassword,
  verifyAccount,
  staffRegister,
  logout,
  register,
} from '../contollers/auth.controller';
import { validateRequest } from '../middlewares/validateRequest.middleware';
import {
  adminRegisterSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  requestVerificationSchema,
  resetPasswordSchema,
  verifyAccountSchema,
  staffRegisterSchema,
} from '../schemas/auth.schemas';
import { authenticateJWT } from '../middlewares/errorHandler.middleware';
import { requireRoles } from '../middlewares/roleCheck.middleware';
import { uploadNIN } from '../config/upload';

export const authRouter = Router();


authRouter.post(
  '/admin/reg',
  validateRequest(adminRegisterSchema),
  adminRegister
);

authRouter.post(
  '/reg',
  uploadNIN.single('ninPhoto'), 
  validateRequest(registerSchema),
  register
);

authRouter.post(
  '/reg/staff',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validateRequest(staffRegisterSchema),
  staffRegister
);

authRouter.post(
  '/login',
  validateRequest(loginSchema),
  login
);


authRouter.post(
  '/resend',
  validateRequest(requestVerificationSchema),
  requestVerificationCode
);


authRouter.put(
  '/verify',
  validateRequest(verifyAccountSchema),
  verifyAccount
);


authRouter.post(
  '/forgot-password',
  validateRequest(forgotPasswordSchema),
  forgotPassword
);

         
authRouter.put(
  '/reset-password',
  validateRequest(resetPasswordSchema),
  resetPassword
);

 
authRouter.post(
  '/logout',
  authenticateJWT,
  logout
);