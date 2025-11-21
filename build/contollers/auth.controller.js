"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.resetPassword = exports.verifyAccount = exports.requestVerificationCode = exports.login = exports.vetLogin = exports.vetRegister = exports.register = exports.adminRegister = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const generateToken_1 = __importDefault(require("../utils/generateToken"));
const argon2_1 = require("argon2");
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const UnauthorizedError_1 = require("../errors/UnauthorizedError");
const generateVerificationCode_1 = require("../utils/generateVerificationCode");
const BadRequestError_1 = require("../errors/BadRequestError");
const mail_services_1 = require("../services/mail.services");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const mailTemplate_1 = require("../utils/mailTemplate");
const dateExpiration_1 = require("../utils/dateExpiration");
const selects_1 = require("../prisma/selects");
const ConflictError_1 = require("../errors/ConflictError");
const phoneFormat_1 = require("../utils/phoneFormat");
// import { isValid } from "zod";
const adminRegister = async (req, res, next) => {
    try {
        const { email, fullName, password, companyName, location, phone, } = req.body;
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            throw new ForbiddenError_1.ForbiddenError("User already registered! Please proceed to login.");
        const existingCompany = await prisma_1.default.company.findUnique({
            where: { name: companyName }
        });
        if (existingCompany) {
            throw new ForbiddenError_1.ForbiddenError("Company name already exists");
        }
        const hashedPassword = await (0, argon2_1.hash)(password);
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)().toString();
        const result = await prisma_1.default.$transaction(async (tx) => {
            // 1. Create the company first
            const company = await tx.company.create({
                data: {
                    name: companyName,
                    location: location,
                    phone: phone,
                    isActive: true
                }
            });
            // 2. Create the admin user linked to the company
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    fullName,
                    companyName: company.name, // Keep companyName for compatibility
                    companyId: company.id, // Link to company with unique ID
                    location,
                    phone,
                    verificationCode,
                    verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
                    role: "ADMIN",
                    isVerified: false
                }
            });
            return { user, company };
        });
        // const data = {
        //   email,
        //   password: hashedPassword,
        //   fullName,
        //   companyName,
        //   verificationCode,
        //   verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
        // };
        // await prisma.user.create({
        //   data,
        // });
        const html = (0, mailTemplate_1.render)("verification", {
            fullName,
            verificationCode,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Agritech" samzdevop@yahoo.com`,
            subject: "Verify your Agritech Account",
            text: "",
            html,
        };
        if (process.env.NODE_ENV !== "test")
            (0, mail_services_1.sendCustomMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Account successfully created, kindly verify your account!", {}, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.adminRegister = adminRegister;
const register = async (req, res, next) => {
    try {
        const { email, phone, fullName, password, role } = req.body;
        if (phone && !(0, phoneFormat_1.validatePhoneNumber)(phone)) {
            throw new BadRequestError_1.BadRequestError('Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)');
        }
        const normalizedPhone = phone ? (0, phoneFormat_1.normalizePhoneNumber)(phone) : null;
        const existingUser = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: email || undefined },
                    { phone: normalizedPhone || undefined }
                ]
            }
        });
        if (existingUser) {
            const conflicts = [];
            if (existingUser.email === email)
                conflicts.push("email");
            if (existingUser.phone === normalizedPhone)
                conflicts.push("phone");
            throw new ConflictError_1.ConflictError(`User already exists with this ${conflicts.join(" and ")}`);
        }
        const createdById = req.user?.id || req.body.createdById;
        if (!createdById) {
            throw new BadRequestError_1.BadRequestError('Creator id not provided');
        }
        const creator = await prisma_1.default.user.findUnique({
            where: { id: createdById },
            select: { companyName: true }
        });
        if (!creator) {
            throw new NotFoundError_1.NotFoundError('Creator not found');
        }
        const hashedPassword = await (0, argon2_1.hash)(password);
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)().toString();
        await prisma_1.default.user.create({
            data: {
                email,
                phone: normalizedPhone,
                password: hashedPassword,
                fullName,
                companyName: creator?.companyName || undefined,
                verificationCode,
                verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
                role: role || "COWORKER",
                isVerified: true,
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Registeration successfully", {}, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const vetRegister = async (req, res, next) => {
    try {
        const { email, phone, fullName, password, location } = req.body;
        if (phone && !(0, phoneFormat_1.validatePhoneNumber)(phone)) {
            throw new BadRequestError_1.BadRequestError('Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)');
        }
        const normalizedPhone = phone ? (0, phoneFormat_1.normalizePhoneNumber)(phone) : null;
        // Check for existing user
        const existingUser = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: email || undefined },
                    { phone: normalizedPhone || undefined }
                ]
            }
        });
        if (existingUser) {
            const conflicts = [];
            if (existingUser.email === email)
                conflicts.push("email");
            if (existingUser.phone === normalizedPhone)
                conflicts.push("phone");
            throw new ForbiddenError_1.ForbiddenError(`User already exists with this credentials`);
        }
        const hashedPassword = await (0, argon2_1.hash)(password);
        const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)().toString();
        // Create vet user with verification
        await prisma_1.default.user.create({
            data: {
                email,
                phone: normalizedPhone,
                password: hashedPassword,
                fullName,
                location,
                verificationCode,
                verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
                role: "VET",
                isVerified: false
            }
        });
        // Send verification email if email is provided
        if (email) {
            const html = (0, mailTemplate_1.render)("verification", {
                fullName,
                verificationCode,
                currentYear: new Date().getFullYear(),
            });
            const mailOptions = {
                to: email,
                from: `"Agritech" penetraliahub@gmail.com`,
                subject: "Verify your Agritech Account",
                text: "",
                html,
            };
            if (process.env.NODE_ENV !== "test")
                (0, mail_services_1.sendCustomMail)(mailOptions);
        }
        // If phone is provided, we add the logic to send SMS verification here
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Vet registration successful. Please verify your account.", {}, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.vetRegister = vetRegister;
const vetLogin = async (req, res, next) => {
    const { email, phone, password } = req.body;
    try {
        if (phone && !(0, phoneFormat_1.validatePhoneNumber)(phone)) {
            throw new BadRequestError_1.BadRequestError('Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)');
        }
        const normalizedPhone = phone ? (0, phoneFormat_1.normalizePhoneNumber)(phone) : undefined;
        // Find user with VET role specifically
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: email ?? undefined },
                    { phone: normalizedPhone ?? undefined }
                ],
                role: "VET" //  only vets can login through this endpoint
            },
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError("Vet account not found");
        const isPasswordValid = await (0, argon2_1.verify)(user.password || "$passwordless", password);
        if (!isPasswordValid)
            throw new BadRequestError_1.BadRequestError("Invalid credentials");
        if (!user.isVerified)
            throw new BadRequestError_1.BadRequestError("Account not verified! Please check your email/phone for verification code.");
        if (user.isSuspended)
            throw new UnauthorizedError_1.UnauthorizedError("Account suspended! Kindly reach out to support");
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });
        const userData = await prisma_1.default.user.findUnique({
            where: { id: user.id },
            select: selects_1.userSelect
        });
        const token = (0, generateToken_1.default)({
            id: user.id,
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Vet login successful", {
            token,
            user: userData
        });
    }
    catch (error) {
        next(error);
    }
};
exports.vetLogin = vetLogin;
const login = async (req, res, next) => {
    const { email, phone, password } = req.body;
    try {
        // Validate phone format if provided
        if (phone && !(0, phoneFormat_1.validatePhoneNumber)(phone)) {
            throw new BadRequestError_1.BadRequestError('Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)');
        }
        const normalizedPhone = phone ? (0, phoneFormat_1.normalizePhoneNumber)(phone) : undefined;
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    // Check for email or phone
                    { email: email ?? undefined },
                    { phone: normalizedPhone ?? undefined }
                ]
            },
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        const isPasswordValid = await (0, argon2_1.verify)(user.password || "$passwordless", password);
        if (!isPasswordValid)
            throw new UnauthorizedError_1.UnauthorizedError("Invalid credentials");
        if (!user.isVerified)
            throw new UnauthorizedError_1.UnauthorizedError("Account not verified!");
        if (user.isSuspended)
            throw new UnauthorizedError_1.UnauthorizedError("Account suspended! Kindly reachout to support@penetralia.com");
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });
        const userData = await prisma_1.default.user.findUnique({
            where: { id: user.id },
            select: selects_1.userSelect
        });
        const token = (0, generateToken_1.default)({
            id: user.id,
            // ...(user.email && {email: user.email}),
            // ...(user.phone && {phone: user.phone})
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Login successful", {
            token,
            user: userData
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
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
                verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
            },
        });
        const html = (0, mailTemplate_1.render)("resend", {
            verificationCode,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Penetralia" samzdevop@yahoo.com`,
            subject: "Reset your Agritech Password",
            text: "",
            html,
        };
        if (process.env.NODE_ENV !== "test")
            (0, mail_services_1.sendCustomMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Verification code successfully sent");
    }
    catch (error) {
        next(error);
    }
};
exports.requestVerificationCode = requestVerificationCode;
const verifyAccount = async (req, res, next) => {
    const { email, verificationCode } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        if (verificationCode !== user.verificationCode)
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        if ((0, dateExpiration_1.compareDates)(user.verificationExpires || new Date(), new Date(), "before"))
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        await prisma_1.default.user.update({
            where: { email },
            data: { isVerified: true, verificationCode: "0" },
        });
        const html = (0, mailTemplate_1.render)("welcome", {
            fullName: user.fullName,
            verificationCode,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Penetralia" samzdevop@yahoo.com`,
            subject: "Welcome to Agritech Africa",
            text: "",
            html,
        };
        if (process.env.NODE_ENV !== "test")
            (0, mail_services_1.sendCustomMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Account verification successful");
    }
    catch (error) {
        next(error);
    }
};
exports.verifyAccount = verifyAccount;
const resetPassword = async (req, res, next) => {
    const { email, password, confirmPassword, verificationCode } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            throw new NotFoundError_1.NotFoundError("User not found");
        if (password !== confirmPassword)
            throw new BadRequestError_1.BadRequestError(`Password don't match`);
        if (verificationCode !== user.verificationCode)
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        if ((0, dateExpiration_1.compareDates)(user.verificationExpires || new Date(), new Date(), "before"))
            throw new UnauthorizedError_1.UnauthorizedError("Invalid or expired verification code");
        const hashedPassword = await (0, argon2_1.hash)(password);
        await prisma_1.default.user.update({
            where: { email },
            data: { password: hashedPassword, verificationCode: "0" },
        });
        const html = (0, mailTemplate_1.render)("reset", {
            fullName: user.fullName,
            currentYear: new Date().getFullYear(),
        });
        const mailOptions = {
            to: email,
            from: `"Penetralia" samzdevop@yahoo.com`,
            subject: "Agritech Password Reset Successful",
            text: "",
            html,
        };
        if (process.env.NODE_ENV !== "test")
            (0, mail_services_1.sendCustomMail)(mailOptions);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Password reset successful");
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword, confirmPassword } = req.body;
        // Validate new password confirmation
        if (newPassword !== confirmPassword) {
            throw new BadRequestError_1.BadRequestError('New password and confirmation do not match');
        }
        // Validate new password length
        if (newPassword.length < 8) {
            throw new BadRequestError_1.BadRequestError('New password must be at least 8 characters long');
        }
        // Get user with password
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { ...selects_1.userSelect, password: true }
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError('User not found');
        }
        // Verify current password
        const isCurrentPasswordValid = await (0, argon2_1.verify)(user.password || "$passwordless", currentPassword);
        if (!isCurrentPasswordValid) {
            throw new UnauthorizedError_1.UnauthorizedError('Current password is incorrect');
        }
        // Hash new password
        const hashedNewPassword = await (0, argon2_1.hash)(newPassword);
        // Update password
        await prisma_1.default.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Password changed successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.changePassword = changePassword;
