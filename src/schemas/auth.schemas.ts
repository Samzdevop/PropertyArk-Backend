import { z } from "zod";
import { validatePhoneNumber } from "../utils/phoneFormat";

export const adminRegisterSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "First Name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    location: z.string().min(1, "Location is required"),
    phone: z.string().min(1, "Phone number is required"),
    companyName: z.string().min(1, "Company Name is required"),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "First Name is required"),
    email: z.string().email("Invalid email format").optional(),
    phone: z.string()
      .min(10, "Phone must be at least 10 digits")
      .refine((val) => validatePhoneNumber(val), {
        message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
      })
    .optional(),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    role: z.enum(['FARM_KEEPER', 'COWORKER']).default('COWORKER'), // Default to COWORKER
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email"],
  }),
});

export const vetRegisterSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "First Name is required"),
    email: z.string().email("Invalid email format").optional(),
    phone: z.string()
      .min(10, "Phone must be at least 10 digits")
      .refine((val) => validatePhoneNumber(val), {
        message: "Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)"
      })
    .optional(),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    location: z.string().optional(),
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email"],
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format").optional(),
    phone: z.string().min(11, "Invalid phone number format").optional(),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email",]
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
    verificationCode: z
      .string()
      .min(4, "Verification code must be at least 4 digits long"),
  }),
});
export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z
      .string()
      .min(8, "Confirm Password must be at least 8 characters long"),
    verificationCode: z
      .string()
      .min(4, "Verification code must be at least 4 digits long"),
  }),
});


export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});