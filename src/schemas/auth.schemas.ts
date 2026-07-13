import { z } from 'zod';
import { validatePhoneNumber } from "../utils/phoneFormat";

export const adminRegisterSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "Full Name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    location: z.string().min(1, "Location is required"),
    phone: z.string().min(10, "Phone number is required")
      .refine((val) => validatePhoneNumber(val), {
        message: "Phone number must be in valid international format (+xxx....)"
      })
      .optional(),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "Full Name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    role: z.enum(['USER', 'VENDOR'], {
      errorMap: () => ({ message: "Role must be either 'USER' or 'VENDOR'" })
    }),
    location: z.string().optional(),
    phone: z.string().optional()
      .refine((val) => !val || validatePhoneNumber(val), {
        message: "Phone number must be in valid international format (+xxx....)"
      }),
  }),
});


export const staffRegisterSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "Full Name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    employeeId: z.string().min(1, "Employee ID is required"),
    department: z.string().min(1, "Department is required"),
    location: z.string().optional(),
    phone: z.string().optional()
      .refine((val) => !val || validatePhoneNumber(val), {
        message: "Phone number must be in valid international format (+xxx....)"
      }),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }),
});

export const requestVerificationSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

export const verifyAccountSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    verificationCode: z.string().min(4, "Verification code must be at least 4 digits long"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format")
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    token: z.string().min(32, "Invalid token format"),
    password: z.string().min(8, "Password must be at least 8 characters long")
  })
});