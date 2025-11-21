"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUpdateUserSchema = exports.changePasswordSchema = exports.updateUserSchema = void 0;
// schemas/users.schemas.ts
const zod_1 = require("zod");
const phoneFormat_1 = require("../utils/phoneFormat");
exports.updateUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, 'Full name is required').optional(),
        location: zod_1.z.string().min(1, 'Location is required').optional(),
        avatar: zod_1.z.string().url('Avatar must be a valid URL').optional(),
        phone: zod_1.z.string()
            .min(10, "Phone must be at least 10 digits")
            .refine((val) => (0, phoneFormat_1.validatePhoneNumber)(val), {
            message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
        })
            .optional(),
        companyName: zod_1.z.string().min(1, 'Company name is required').optional(),
    }),
});
// export const updateProfileSchema = z.object({
//   body: z.object({
//     fullName: z.string().min(1, 'Full name is required').optional(),
//     location: z.string().min(1, 'Location is required').optional(),
//     avatar: z.string().url('Avatar must be a valid URL').optional(),
//     phone: z.string()
//       .min(10, "Phone must be at least 10 digits")
//       .refine((val) => validatePhoneNumber(val), {
//         message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
//       })
//       .optional(),
//     companyName: z.string().min(1, 'Company name is required').optional(),
//   }),
// });
exports.changePasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string().min(1, 'Current password is required'),
        newPassword: zod_1.z.string().min(8, 'New password must be at least 8 characters long'),
        confirmPassword: zod_1.z.string().min(1, 'Password confirmation is required'),
    }).refine((data) => data.newPassword === data.confirmPassword, {
        message: "New password and confirmation do not match",
        path: ["confirmPassword"],
    }),
});
exports.adminUpdateUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, 'Full name is required').optional(),
        location: zod_1.z.string().min(1, 'Location is required').optional(),
        avatar: zod_1.z.string().url('Avatar must be a valid URL').optional(),
        phone: zod_1.z.string()
            .min(10, "Phone must be at least 10 digits")
            .refine((val) => (0, phoneFormat_1.validatePhoneNumber)(val), {
            message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
        })
            .optional(),
        companyName: zod_1.z.string().min(1, 'Company name is required').optional(),
        role: zod_1.z.enum(['ADMIN', 'FARM_KEEPER', 'COWORKER', 'VET']).optional(),
        isSuspended: zod_1.z.boolean().optional(),
    }),
});
