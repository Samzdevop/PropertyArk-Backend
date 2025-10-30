import { Router } from 'express';
import {
	login,
	adminRegister,
	requestVerificationCode,
	resetPassword,
	verifyAccount,
	register,
	vetRegister,
	vetLogin,
} from '../contollers/auth.controller';
import { validateRequest } from '../middlewares/validateRequest';
import {
	loginSchema,
	adminRegisterSchema,
	requestVerificationSchema,
	resetPasswordSchema,
	verifyAccountSchema,
	registerSchema,
	vetRegisterSchema,
} from '../schemas/auth.schemas';
import passport from 'passport';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { authenticateJWT } from '../middlewares/errorHandler';
import { requireRoles } from '../middlewares/roleCheck';

export const authRouter = Router();

authRouter.post('/admin-reg', validateRequest(adminRegisterSchema), adminRegister);

authRouter.post(
	'/register',
	authenticateJWT,
	requireRoles(['ADMIN', 'FARM_KEEPER']),
	validateRequest(registerSchema),
	register
);

authRouter.post(
	'/login',
	validateRequest(loginSchema), 
	login
);

authRouter.post(
  '/vet-reg',
  validateRequest(vetRegisterSchema),
  vetRegister
);

authRouter.post(
	'/vet-login', 
	validateRequest(loginSchema),
	vetLogin
);

authRouter.post(
	'/resend',
	validateRequest(requestVerificationSchema),
	requestVerificationCode
);

authRouter.put('/verify', validateRequest(verifyAccountSchema), verifyAccount);

authRouter.put('/reset', validateRequest(resetPasswordSchema), resetPassword);

// Google Strategy
authRouter.get(
	'/google',
	passport.authenticate('google', { scope: ['profile', 'email'] })
);

authRouter.get(
	'/google/callback',
	passport.authenticate('google', { session: false }),
	(req, res) => {
		const { user, token } = req.user as any;
		res.json({
			message: 'Login successful',
			user,
			token,
		});
		sendSuccessResponse(res, 'Login successful', { user, token });
	}
);

authRouter.get('/failure', (_req, res) => {
	res.status(401).json({ error: 'Failed to authenticate' });
});