"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.verifyAccountSchema = exports.requestVerificationSchema = exports.loginSchema = exports.staffRegisterSchema = exports.registerSchema = exports.adminRegisterSchema = void 0;
const zod_1 = require("zod");
const phoneFormat_1 = require("../utils/phoneFormat");
exports.adminRegisterSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, "Full Name is required"),
        email: zod_1.z.string().email("Invalid email format"),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
        location: zod_1.z.string().min(1, "Location is required"),
        phone: zod_1.z.string().min(10, "Phone number is required")
            .refine((val) => (0, phoneFormat_1.validatePhoneNumber)(val), {
            message: "Phone number must be in valid international format (+xxx....)"
        })
            .optional(),
    }),
});
exports.registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, "Full Name is required"),
        email: zod_1.z.string().email("Invalid email format"),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
        role: zod_1.z.enum(['USER', 'VENDOR'], {
            errorMap: () => ({ message: "Role must be either 'USER' or 'VENDOR'" })
        }),
        location: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional()
            .refine((val) => !val || (0, phoneFormat_1.validatePhoneNumber)(val), {
            message: "Phone number must be in valid international format (+xxx....)"
        }),
    }),
});
exports.staffRegisterSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, "Full Name is required"),
        email: zod_1.z.string().email("Invalid email format"),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
        employeeId: zod_1.z.string().min(1, "Employee ID is required"),
        department: zod_1.z.string().min(1, "Department is required"),
        location: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional()
            .refine((val) => !val || (0, phoneFormat_1.validatePhoneNumber)(val), {
            message: "Phone number must be in valid international format (+xxx....)"
        }),
    }),
});
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
    }),
});
exports.requestVerificationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
    }),
});
exports.verifyAccountSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
        verificationCode: zod_1.z.string().min(4, "Verification code must be at least 4 digits long"),
    }),
});
exports.forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format")
    })
});
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
        token: zod_1.z.string().min(32, "Invalid token format"),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters long")
    })
});
