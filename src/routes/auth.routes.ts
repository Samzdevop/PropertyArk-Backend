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
import passport from 'passport';

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

authRouter.get(
  '/google',
  (req, res, next) => {
    const role = req.query.role as string || 'USER';
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: role, // Pass role as state
    })(req, res, next);
  }
);

authRouter.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', {
      session: false, // We don't want to use session, we use JWT
      failureRedirect: '/auth/failure',
    }, (err: any, data: any) => {
      if (err || !data) {
        console.error('❌ Google Auth Error:', err?.message || 'No data');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
      }

      const { user, token } = data;
      
      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`;
      return res.redirect(redirectUrl);
    })(req, res, next);
  }
);

// Google auth failure
authRouter.get('/failure', (_req, res) => {
  res.status(401).json({ 
    success: false, 
    message: 'Google authentication failed' 
  });
});

// Google auth success (API response version - for mobile apps)
authRouter.get(
  '/google/callback/api',
  (req, res, next) => {
    passport.authenticate('google', { 
      session: false,
      failureRedirect: '/auth/failure',
    }, (err: any, data: any) => {
      if (err || !data) {
        return res.status(401).json({
          success: false,
          message: 'Google authentication failed'
        });
      }
      const { user, token } = data;
      res.json({
        success: true,
        message: 'Google login successful',
        data: { user, token }
      });
    })(req, res, next);
  }
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
