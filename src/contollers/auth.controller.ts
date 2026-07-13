import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import generateToken from "../utils/generateToken";
import { hash, verify } from "argon2";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { NotFoundError } from "../errors/NotFoundError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { generateVerificationCode } from "../utils/generateVerificationCode";
import { MailInterface } from "../interfaces/mail.interfaces";
import { ForbiddenError } from "../errors/ForbiddenError";
import { render } from "../utils/mailTemplate";
import { compareDates } from "../utils/dateExpiration";
import { sendGraphMail } from "../services/mail.services";
import Logger from "../config/logger";
import { PasswordResetService } from "../services/passwordReset.service";
import { uploadToAzure, STORAGE_CONTAINERS } from "../config/upload";
import { Role, VerificationStatus } from "@prisma/client";
import { userSelect } from "../prisma/selects";


export const adminRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, fullName, password, phone, location } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ForbiddenError('User already registered!');
    }

    const hashedPassword = await hash(password);
    const verificationCode = generateVerificationCode();

    await prisma.user.create({
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

    const html = await render("verification", {
      fullName,
      verificationCode,
      currentYear: new Date().getFullYear(),
    });

    const mailOptions: MailInterface = {
      to: email,
      from: `"Property Management" ${process.env.SENDER_EMAIL}`,
      subject: "Verify your Property Management Account",
      text: `Your verification code is ${verificationCode}`,
      html,
    };

    if (process.env.NODE_ENV !== "test") await sendGraphMail(mailOptions);

    sendSuccessResponse(res, 'Admin account successfully created. Please check your email for verification code.', {}, 201);
  } catch (error) {
    next(error);
  }
};



export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, fullName, password, location, phone, role } = req.body;
    const file = req.file;

    // Validate role
    if (!role || (role !== 'USER' && role !== 'VENDOR')) {
      throw new ForbiddenError("Role must be either 'USER' or 'VENDOR'");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ForbiddenError("User already registered!");
    }

    // If VENDOR, NIN photo is required
    if (role === 'VENDOR' && !file) {
      throw new ForbiddenError("NIN photo is required for vendor registration");
    }

    const hashedPassword = await hash(password);
    const verificationCode = generateVerificationCode();

    let ninPhotoUrl = null;
    let ninVerificationStatus = VerificationStatus.PENDING;

    // Build user data based on role
    const userData: any = {
      email,
      password: hashedPassword,
      fullName,
      phone,
      location,
      role: role === 'VENDOR' ? Role.VENDOR : Role.USER,
      isVerified: false,
      verificationCode,
      verificationExpires: new Date(Date.now() + 30 * 60 * 1000),
    };

    // If VENDOR, handle NIN upload
    if (role === 'VENDOR' && file) {
      // Upload NIN photo
      if (process.env.STORAGE_DRIVER === 'azure') {
        ninPhotoUrl = await uploadToAzure(file, STORAGE_CONTAINERS.NIN_DOCUMENTS);
      } else {
        ninPhotoUrl = `/uploads/${file.filename}`;
      }

      userData.ninPhotoUrl = ninPhotoUrl;
      userData.ninVerificationStatus = VerificationStatus.PENDING;
    }

    const user = await prisma.user.create({
      data: userData
    });

    // If VENDOR, create NIN document record
    if (role === 'VENDOR' && file && ninPhotoUrl) {
      await prisma.document.create({
        data: {
          name: `NIN_${fullName.replace(/\s/g, '_')}`,
          type: 'NIN',
          url: ninPhotoUrl,
          key: ninPhotoUrl.split('/').pop() || '',
          size: file.size,
          mimeType: file.mimetype,
          container: STORAGE_CONTAINERS.NIN_DOCUMENTS,
          vendorId: user.id,
          uploadedById: user.id
        }
      });
    }

    // Send verification email
    try {
      const html = await render("verification", {
        fullName,
        verificationCode,
        currentYear: new Date().getFullYear(),
      });

      const mailOptions: MailInterface = {
        to: email,
        from: `"Property Management" ${process.env.SENDER_EMAIL}`,
        subject: "Verify your Property Management Account",
        text: `Your verification code is ${verificationCode}`,
        html,
      };

      await sendGraphMail(mailOptions);
      Logger.info(`Verification email sent to ${email}`);
    } catch (emailError) {
      Logger.error(`Failed to send verification email to ${email}:`, emailError);
    }

    const responseMessage = role === 'VENDOR'
      ? "Vendor account created successfully. Please check your email for verification code. Your NIN is pending admin verification."
      : "User account created successfully. Please check your email for verification code.";

    const responseData = role === 'VENDOR'
      ? { ninVerificationStatus: VerificationStatus.PENDING }
      : {};

    sendSuccessResponse(res, responseMessage, responseData, 201);
  } catch (error) {
    next(error);
  }
};



export const staffRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, fullName, password, phone, location, employeeId, department } = req.body;
    const user = req.user as any;

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can create staff accounts");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ForbiddenError("User already registered!");
    }

    const existingEmployeeId = await prisma.user.findUnique({
      where: { employeeId }
    });
    if (existingEmployeeId) {
      throw new ForbiddenError("Employee ID already exists!");
    }

    const hashedPassword = await hash(password);
    const verificationCode = generateVerificationCode();

    await prisma.user.create({
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
      const html = await render("verification", {
        fullName,
        verificationCode,
        currentYear: new Date().getFullYear(),
      });

      const mailOptions: MailInterface = {
        to: email,
        from: `"Property Management" ${process.env.SENDER_EMAIL}`,
        subject: "Verify your Staff Account",
        text: `Your verification code is ${verificationCode}`,
        html,
      };

      await sendGraphMail(mailOptions);
      Logger.info(`Verification email sent to ${email}`);
    } catch (emailError) {
      Logger.error(`Failed to send verification email to ${email}:`, emailError);
    }

    sendSuccessResponse(
      res,
      "Staff account created successfully. Please check your email for verification code.",
      {},
      201
    );
  } catch (error) {
    next(error);
  }
};


export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, password } = req.body;

    try {
        const user = await prisma.user.findFirst({ where: { email } });
        if (!user) throw new NotFoundError("User not found");

        const isPasswordValid = await verify(
            user.password || "$passwordless",
            password
        );
        if (!isPasswordValid) throw new UnauthorizedError("Invalid credentials");

        if (!user.isVerified) throw new UnauthorizedError("Account not verified! Please verify your email.");

        if (user.isSuspended) {
          throw new UnauthorizedError("Account suspended! Please contact support.");
        };

        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: userSelect
        });

        const token = generateToken({
            id: user.id,
        });
        sendSuccessResponse(res, "Login successful", { token, user: userData });
    } catch (error) {
        next(error);
    }
};

export const verifyAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const { email, verificationCode } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new NotFoundError("User not found");

        if (verificationCode !== user.verificationCode) {
            throw new UnauthorizedError("Invalid or expired verification code");
        }

        if (compareDates(user.verificationExpires || new Date(), new Date(), "before")) {
         throw new UnauthorizedError("Invalid or expired verification code");
        }

        await prisma.user.update({
            where: { email },
            data: {
                isVerified: true,
                verificationCode: null,
                verificationExpires: null,
            },
        });
        sendSuccessResponse(res, "Account verification successful");
    } catch (error) {
      next(error);
    }
};


export const requestVerificationCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");

    const verificationCode = generateVerificationCode().toString();

    await prisma.user.update({
      where: { email },
      data: {
        verificationCode,
        verificationExpires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const html = await render("resend", {
      fullName: user.fullName,
      verificationCode,
      currentYear: new Date().getFullYear(),
    });

    const mailOptions: MailInterface = {
      to: email,
      from: `"Property Management" ${process.env.SENDER_EMAIL}`,
      subject: "Account Verification Code",
      text: `Your verification code is ${verificationCode}`,
      html,
    };

    if (process.env.NODE_ENV !== "test") await sendGraphMail(mailOptions);

    sendSuccessResponse(res, "Verification code successfully sent");
  } catch (error) {
    next(error);
  }
};


export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
    try {
        const { email } = req.body;
        await PasswordResetService.requestPasswordReset(email);
        sendSuccessResponse(
        res,
        "If the email address is associated with an account, password reset instructions have been sent.",
        {},
        200
        );
    } catch (error) {
        next(error);
    }
};


export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, token, password } = req.body;
    await PasswordResetService.resetPassword(email, token, password);
    sendSuccessResponse(res, "Password has been reset successfully. Please log in with your new password.");
  } catch (error) {
    next(error);
  }
};


export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;

    if (userId) {
      await prisma.activityLog.create({
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

    sendSuccessResponse(res, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};