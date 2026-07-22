"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../contollers/auth.controller");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const auth_schemas_1 = require("../schemas/auth.schemas");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const upload_1 = require("../config/upload");
const passport_1 = __importDefault(require("passport"));
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/admin/reg', (0, validateRequest_middleware_1.validateRequest)(auth_schemas_1.adminRegisterSchema), auth_controller_1.adminRegister);
exports.authRouter.post('/reg', upload_1.uploadNIN.single('ninPhoto'), (0, validateRequest_middleware_1.validateRequest)(auth_schemas_1.registerSchema), auth_controller_1.register);
exports.authRouter.post('/reg/staff', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(auth_schemas_1.staffRegisterSchema), auth_controller_1.staffRegister);
exports.authRouter.post('/login', (0, validateRequest_middleware_1.validateRequest)(auth_schemas_1.loginSchema), auth_controller_1.login);
exports.authRouter.get('/google', (req, res, next) => {
    const role = req.query.role || 'USER';
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
        state: role,
    })(req, res, next);
});
// Step 2: Google callback with role from state
exports.authRouter.get('/google/callback', (req, res, next) => {
    passport_1.default.authenticate('google', {
        session: false,
        failureRedirect: '/auth/failure',
    }, (err, data) => {
        if (err || !data) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
        }
        const { user, token } = data;
        const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`;
        return res.redirect(redirectUrl);
    })(req, res, next);
});
// Google auth failure
exports.authRouter.get('/failure', (_req, res) => {
    res.status(401).json({
        success: false,
        message: 'Google authentication failed'
    });
});
// Google auth success (API response version - for mobile apps)
exports.authRouter.get('/google/callback/api', (req, res, next) => {
    passport_1.default.authenticate('google', {
        session: false,
        failureRedirect: '/auth/failure',
    }, (err, data) => {
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
});
exports.authRouter.post('/resend', (0, validateRequest_middleware_1.validateRequest)(auth_schemas_1.requestVerificationSchema), auth_controller_1.requestVerificationCode);
exports.authRouter.put('/verify', (0, validateRequest_middleware_1.validateRequest)(auth_schemas_1.verifyAccountSchema), auth_controller_1.verifyAccount);
exports.authRouter.post('/forgot-password', (0, validateRequest_middleware_1.validateRequest)(auth_schemas_1.forgotPasswordSchema), auth_controller_1.forgotPassword);
exports.authRouter.put('/reset-password', (0, validateRequest_middleware_1.validateRequest)(auth_schemas_1.resetPasswordSchema), auth_controller_1.resetPassword);
exports.authRouter.post('/logout', errorHandler_middleware_1.authenticateJWT, auth_controller_1.logout);
