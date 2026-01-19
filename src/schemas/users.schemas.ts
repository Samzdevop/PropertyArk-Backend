import { z } from 'zod';
import { validatePhoneNumber } from '../utils/phoneFormat';

export const updateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').optional(),
    location: z.string().min(1, 'Location is required').optional(),
    avatar: z.string().url('Avatar must be a valid URL').optional(),
    phone: z.string()
      .min(10, "Phone must be at least 10 digits")
      .refine((val) => validatePhoneNumber(val), {
        message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
      })
      .optional(),
      companyName: z.string().min(1, 'Company name is required').optional(),
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

export const changePasswordSchema = z.object({
  body: z.object({
    // currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  }),
});

export const adminUpdateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').optional(),
    location: z.string().min(1, 'Location is required').optional(),
    avatar: z.string().url('Avatar must be a valid URL').optional(),
    phone: z.string()
      .min(10, "Phone must be at least 10 digits")
      .refine((val) => validatePhoneNumber(val), {
        message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
      })
      .optional(),
    companyName: z.string().min(1, 'Company name is required').optional(),
    role: z.enum(['ADMIN', 'FARM_KEEPER', 'COWORKER', 'VET']).optional(),
    isSuspended: z.boolean().optional(),
  }),
});