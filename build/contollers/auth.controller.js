"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.resetPassword = exports.forgotPassword = exports.requestVerificationCode = exports.verifyAccount = exports.login = exports.staffRegister = exports.register = exports.adminRegister = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const generateToken_1 = __importDefault(require("../utils/generateToken"));
const argon2_1 = require("argon2");
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const UnauthorizedError_1 = require("../errors/UnauthorizedError");
const generateVerificationCode_1 = require("../utils/generateVerificationCode");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const mailTemplate_1 = require("../utils/mailTemplate");
const dateExpiration_1 = require("../utils/dateExpiration");
const mail_services_1 = require("../services/mail.services");
const logger_1 = __importDefault(require("../config/logger"));
const passwordReset_service_1 = require("../services/passwordReset.service");
const upload_1 = require("../config/upload");
const client_1 = require("@prisma/client");
const selects_1 = require("../prisma/selects");
const adminRegister = async (req, res, next) => {
    try {
        const { email, fullName, password, phone, location } = req.body;
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new ForbiddenError_1.ForbiddenError('User already registered!');
        }
        const hashedPassword = await (0, argon2_1.hash)(password);
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)();
        await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName,
                phone,
                location,
                role: 'ADMIN',
                isVerified: false,
                verificationCode,
                verificationExpires: new Date(Date.now() + 30 * 60 * 1000)
            }
        });
        const html = await (0, mailTemplate_1.render)("verification", {
            fullName,
            verificationCode,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Property Management" ${process.env.SENDER_EMAIL}`,
            subject: "Verify your Property Management Account",
            text: `Your verification code is ${verificationCode}`,
            html,
        };
        if (process.env.NODE_ENV !== "test")
            await (0, mail_services_1.sendGraphMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Admin account successfully created. Please check your email for verification code.', {}, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.adminRegister = adminRegister;
const register = async (req, res, next) => {
    try {
        const { email, fullName, password, location, phone, role } = req.body;
        const file = req.file;
        // Validate role
        if (!role || (role !== 'USER' && role !== 'VENDOR')) {
            throw new ForbiddenError_1.ForbiddenError("Role must be either 'USER' or 'VENDOR'");
        }
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new ForbiddenError_1.ForbiddenError("User already registered!");
        }
        // If VENDOR, NIN photo is required
        if (role === 'VENDOR' && !file) {
            throw new ForbiddenError_1.ForbiddenError("NIN photo is required for vendor registration");
        }
        const hashedPassword = await (0, argon2_1.hash)(password);
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)();
        let ninPhotoUrl = null;
        let ninVerificationStatus = client_1.VerificationStatus.PENDING;
        // Build user data based on role
        const userData = {
            email,
            password: hashedPassword,
            fullName,
            phone,
            location,
            role: role === 'VENDOR' ? client_1.Role.VENDOR : client_1.Role.USER,
            isVerified: false,
            verificationCode,
            verificationExpires: new Date(Date.now() + 30 * 60 * 1000),
        };
        // If VENDOR, handle NIN upload
        if (role === 'VENDOR' && file) {
            // Upload NIN photo
            if (process.env.STORAGE_DRIVER === 'azure') {
                ninPhotoUrl = await (0, upload_1.uploadToAzure)(file, upload_1.STORAGE_CONTAINERS.NIN_DOCUMENTS);
            }
            else {
                ninPhotoUrl = `/uploads/${file.filename}`;
            }
            userData.ninPhotoUrl = ninPhotoUrl;
            userData.ninVerificationStatus = client_1.VerificationStatus.PENDING;
        }
        const user = await prisma_1.default.user.create({
            data: userData
        });
        // If VENDOR, create NIN document record
        if (role === 'VENDOR' && file && ninPhotoUrl) {
            await prisma_1.default.document.create({
                data: {
                    name: `NIN_${fullName.replace(/\s/g, '_')}`,
                    type: 'NIN',
                    url: ninPhotoUrl,
                    key: ninPhotoUrl.split('/').pop() || '',
                    size: file.size,
                    mimeType: file.mimetype,
                    container: upload_1.STORAGE_CONTAINERS.NIN_DOCUMENTS,
                    vendorId: user.id,
                    uploadedById: user.id
                }
            });
        }
        // Send verification email
        try {
            const html = await (0, mailTemplate_1.render)("verification", {
                fullName,
                verificationCode,
                currentYear: new Date().getFullYear(),
            });
            const mailOptions = {
                to: email,
                from: `"Property Management" ${process.env.SENDER_EMAIL}`,
                subject: "Verify your Property Management Account",
                text: `Your verification code is ${verificationCode}`,
                html,
            };
            await (0, mail_services_1.sendGraphMail)(mailOptions);
            logger_1.default.info(`Verification email sent to ${email}`);
        }
        catch (emailError) {
            logger_1.default.error(`Failed to send verification email to ${email}:`, emailError);
        }
        const responseMessage = role === 'VENDOR'
            ? "Vendor account created successfully. Please check your email for verification code. Your NIN is pending admin verification."
            : "User account created successfully. Please check your email for verification code.";
        const responseData = role === 'VENDOR'
            ? { ninVerificationStatus: client_1.VerificationStatus.PENDING }
            : {};
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, responseMessage, responseData, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const staffRegister = async (req, res, next) => {
    try {
        const { email, fullName, password, phone, location, employeeId, department } = req.body;
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can create staff accounts");
        }
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new ForbiddenError_1.ForbiddenError("User already registered!");
        }
        const existingEmployeeId = await prisma_1.default.user.findUnique({
            where: { employeeId }
        });
        if (existingEmployeeId) {
            throw new ForbiddenError_1.ForbiddenError("Employee ID already exists!");
        }
        const hashedPassword = await (0, argon2_1.hash)(password);
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)();
        await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName,
                phone,
                location,
                role: 'STAFF',
                employeeId,
                department,
                isVerified: true,
                verificationCode,
                verificationExpires: new Date(Date.now() + 30 * 60 * 1000)
            }
        });
        try {
            const html = await (0, mailTemplate_1.render)("verification", {
                fullName,
                verificationCode,
                currentYear: new Date().getFullYear(),
            });
            const mailOptions = {
                to: email,
                from: `"Property Management" ${process.env.SENDER_EMAIL}`,
                subject: "Verify your Staff Account",
                text: `Your verification code is ${verificationCode}`,
                html,
            };
            await (0, mail_services_1.sendGraphMail)(mailOptions);
            logger_1.default.info(`Verification email sent to ${email}`);
        }
        catch (emailError) {
            logger_1.default.error(`Failed to send verification email to ${email}:`, emailError);
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Staff account created successfully. Please check your email for verification code.", {}, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.staffRegister = staffRegister;
const login = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await prisma_1.default.user.findFirst({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        const isPasswordValid = await (0, argon2_1.verify)(user.password || "$passwordless", password);
        if (!isPasswordValid)
            throw new UnauthorizedError_1.UnauthorizedError("Invalid credentials");
        if (!user.isVerified)
            throw new UnauthorizedError_1.UnauthorizedError("Account not verified! Please verify your email.");
        if (user.isSuspended) {
            throw new UnauthorizedError_1.UnauthorizedError("Account suspended! Please contact support.");
        }
        ;
        const userData = await prisma_1.default.user.findUnique({
            where: { id: user.id },
            select: selects_1.userSelect
        });
        const token = (0, generateToken_1.default)({
            id: user.id,
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Login successful", { token, user: userData });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const verifyAccount = async (req, res, next) => {
    const { email, verificationCode } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        if (verificationCode !== user.verificationCode) {
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        }
        if ((0, dateExpiration_1.compareDates)(user.verificationExpires || new Date(), new Date(), "before")) {
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        }
        await prisma_1.default.user.update({
            where: { email },
            data: {
                isVerified: true,
                verificationCode: null,
                verificationExpires: null,
            },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Account verification successful");
    }
    catch (error) {
        next(error);
    }
};
exports.verifyAccount = verifyAccount;
const requestVerificationCode = async (req, res, next) => {
    const { email } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)().toString();
        await prisma_1.default.user.update({
            where: { email },
            data: {
                verificationCode,
                verificationExpires: new Date(Date.now() + 30 * 60 * 1000),
            },
        });
        const html = await (0, mailTemplate_1.render)("resend", {
            fullName: user.fullName,
            verificationCode,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Property Management" ${process.env.SENDER_EMAIL}`,
            subject: "Account Verification Code",
            text: `Your verification code is ${verificationCode}`,
            html,
        };
        if (process.env.NODE_ENV !== "test")
            await (0, mail_services_1.sendGraphMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Verification code successfully sent");
    }
    catch (error) {
        next(error);
    }
};
exports.requestVerificationCode = requestVerificationCode;
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        await passwordReset_service_1.PasswordResetService.requestPasswordReset(email);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "If the email address is associated with an account, password reset instructions have been sent.", {}, 200);
    }
    catch (error) {
        next(error);
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res, next) => {
    try {
        const { email, token, password } = req.body;
        await passwordReset_service_1.PasswordResetService.resetPassword(email, token, password);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Password has been reset successfully. Please log in with your new password.");
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
const logout = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (userId) {
            await prisma_1.default.activityLog.create({
                data: {
                    userId,
                    action: 'LOGOUT',
                    entityType: 'USER',
                    entityId: userId,
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent')
                }
            });
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Logged out successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
