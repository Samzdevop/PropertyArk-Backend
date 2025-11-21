"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../contollers/auth.controller");
const validateRequest_1 = require("../middlewares/validateRequest");
const auth_schemas_1 = require("../schemas/auth.schemas");
const passport_1 = __importDefault(require("passport"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const errorHandler_1 = require("../middlewares/errorHandler");
const roleCheck_1 = require("../middlewares/roleCheck");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/admin-reg', (0, validateRequest_1.validateRequest)(auth_schemas_1.adminRegisterSchema), auth_controller_1.adminRegister);
exports.authRouter.post('/register', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER']), (0, validateRequest_1.validateRequest)(auth_schemas_1.registerSchema), auth_controller_1.register);
exports.authRouter.post('/login', (0, validateRequest_1.validateRequest)(auth_schemas_1.loginSchema), auth_controller_1.login);
exports.authRouter.post('/vet-reg', (0, validateRequest_1.validateRequest)(auth_schemas_1.vetRegisterSchema), auth_controller_1.vetRegister);
exports.authRouter.post('/vet-login', (0, validateRequest_1.validateRequest)(auth_schemas_1.loginSchema), auth_controller_1.vetLogin);
exports.authRouter.post('/resend', (0, validateRequest_1.validateRequest)(auth_schemas_1.requestVerificationSchema), auth_controller_1.requestVerificationCode);
exports.authRouter.put('/verify', (0, validateRequest_1.validateRequest)(auth_schemas_1.verifyAccountSchema), auth_controller_1.verifyAccount);
exports.authRouter.put('/reset', (0, validateRequest_1.validateRequest)(auth_schemas_1.resetPasswordSchema), auth_controller_1.resetPassword);
// Google Strategy
exports.authRouter.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
exports.authRouter.get('/google/callback', passport_1.default.authenticate('google', { session: false }), (req, res) => {
    const { user, token } = req.user;
    res.json({
        message: 'Login successful',
        user,
        token,
    });
    (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Login successful', { user, token });
});
exports.authRouter.get('/failure', (_req, res) => {
    res.status(401).json({ error: 'Failed to authenticate' });
});
