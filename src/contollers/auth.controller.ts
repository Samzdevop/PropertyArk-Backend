
import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import generateToken, { generateResetToken } from "../utils/generateToken";
import { hash, verify } from "argon2";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { NotFoundError } from "../errors/NotFoundError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { generateVerificationCode } from "../utils/generateVerificationCode";
import { BadRequestError } from "../errors/BadRequestError";
import { MailInterface } from "../interfaces/mail.interfaces";
import { sendCustomMail } from "../services/mail.services";
import { ForbiddenError } from "../errors/ForbiddenError";
import { render } from "../utils/mailTemplate";
import { compareDates } from "../utils/dateExpiration";
import { userSelect } from "../prisma/selects";
import { ConflictError } from "../errors/ConflictError";
import { normalizePhoneNumber, validatePhoneNumber } from "../utils/phoneFormat";
// import { isValid } from "zod";

export const adminRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, fullName, password, companyName, location, phone, } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      throw new ForbiddenError(
        "User already registered! Please proceed to login."
      );

    const existingCompany = await prisma.company.findUnique({
      where: { name: companyName }
    });

    if (existingCompany) {
      throw new ForbiddenError("Company name already exists");
    }

    const hashedPassword = await hash(password);
    const verificationCode = generateVerificationCode().toString();
    const result = await prisma.$transaction(async (tx) => {
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
          companyId: company.id,     // Link to company with unique ID
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
    const html = render("verification", {
      fullName,
      verificationCode,
      currentYear: new Date().getFullYear(),
    });
    const mailOptions: MailInterface = {
      to: email,
      from: `"Agritech" samzdevop@yahoo.com`,
      subject: "Verify your Agritech Account",
      text: "",
      html,
    };

    if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);


    sendSuccessResponse(
      res,
      "Account successfully created, kindly verify your account!",
      {},
      201
    );
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
    const { email, phone, fullName, password, role } = req.body;
    const { companyId } = req.params;

     if (phone && !validatePhoneNumber(phone)) {
      throw new BadRequestError(
        'Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)'
      );
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          {email: email || undefined },
          { phone: normalizedPhone || undefined }
        ]
      }
    });


    if (existingUser) {
      const conflicts = [];
      if(existingUser.email === email) conflicts.push("email");
      if(existingUser.phone === normalizedPhone) conflicts.push("phone");
      throw new ConflictError(
        `User already exists with this ${conflicts.join(" and ")}`
      );
    }

    const createdById = (req.user as any)?.id || req.body.createdById;
    if (!createdById) {
      throw new BadRequestError('Creator id not provided');
    }

    const creator = await prisma.user.findUnique({
      where: { id: createdById },
      select: { companyName: true }
    });

    if (!creator) {
      throw new NotFoundError('Creator not found');
    }

    const hashedPassword = await hash(password);
    const verificationCode = generateVerificationCode().toString();
    await prisma.user.create({
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
      companyId: companyId
    }
  });
  sendSuccessResponse(res, "Registeration successfully", 
{}, 201);
  } catch (error) {
    next(error);
  }
};


export const vetRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, phone, fullName, password, location } = req.body;

    if (phone && !validatePhoneNumber(phone)) {
      throw new BadRequestError(
        'Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)'
      );
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { phone: normalizedPhone || undefined }
        ]
      }
    });

    if (existingUser) {
      const conflicts = [];
      if(existingUser.email === email) conflicts.push("email");
      if(existingUser.phone === normalizedPhone) conflicts.push("phone");
      throw new ForbiddenError(
        `User already exists with this credentials`
      );
    }

    const hashedPassword = await hash(password);
    const verificationCode = generateVerificationCode().toString();
    
    // Create vet user with verification
    await prisma.user.create({
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
      const html = render("verification", {
        fullName,
        verificationCode,
        currentYear: new Date().getFullYear(),
      });
      const mailOptions: MailInterface = {
        to: email,
        from: `"Agritech" penetraliahub@gmail.com`,
        subject: "Verify your Agritech Account",
        text: "",
        html,
      };

      if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);
    }
    // If phone is provided, we add the logic to send SMS verification here

    sendSuccessResponse(
      res, 
      "Vet registration successful. Please verify your account.", 
      {}, 
      201
    );
  } catch (error) {
    next(error);
  }
};


export const vetLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, phone, password } = req.body;

  try {
    if (phone && !validatePhoneNumber(phone)) {
      throw new BadRequestError(
        'Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)'
      );
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    
    // Find user with VET role specifically
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email ?? undefined },
          { phone: normalizedPhone ?? undefined }
        ],
        role: "VET" //  only vets can login through this endpoint
      },
    });

    if (!user) throw new NotFoundError("Vet account not found");

    const isPasswordValid = await verify(
      user.password || "$passwordless",
      password
    );
    if (!isPasswordValid) throw new BadRequestError("Invalid credentials");

    if (!user.isVerified) throw new BadRequestError("Account not verified! Please check your email/phone for verification code.");
    if (user.isSuspended)
      throw new UnauthorizedError(
        "Account suspended! Kindly reach out to support"
      );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect
    });

    const token = generateToken({
      id: user.id,
    });

    sendSuccessResponse(res, "Vet login successful", { 
      token, 
      user: userData
    });
  } catch (error) {
    next(error);
  }
}



export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, phone, password } = req.body;

  try {
      // Validate phone format if provided
    if (phone && !validatePhoneNumber(phone)) {
      throw new BadRequestError(
        'Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)'
      );
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          // Check for email or phone
        { email: email ?? undefined },
        {phone: normalizedPhone ?? undefined }
      ]
      },
      });

    if (!user) throw new NotFoundError("User not found");

    const isPasswordValid = await verify(
      user.password || "$passwordless",
      password
    );
    if (!isPasswordValid) throw new UnauthorizedError("Invalid credentials");

    if (!user.isVerified) throw new UnauthorizedError("Account not verified!");
    if (user.isSuspended)
      throw new UnauthorizedError(
        "Account suspended! Kindly reachout to support@penetralia.com"
      );

    await prisma.user.update({
      where: {id: user.id},
      data: {lastLogin: new Date()}
    })

    const userData = await prisma.user.findUnique({
      where: { id: user.id},
      select: userSelect
    }) 
    const token = generateToken({
      id: user.id,
      // ...(user.email && {email: user.email}),
      // ...(user.phone && {phone: user.phone})
    });
    sendSuccessResponse(res, "Login successful", { 
      token, 
      user: userData
     });
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
        verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
      },
    });
    const html = render("resend", {
      verificationCode,
      currentYear: new Date().getFullYear(),
    });
    const mailOptions: MailInterface = {
      to: email,
      from: `"Penetralia" samzdevop@yahoo.com`,
      subject: "Reset your Agritech Password",
      text: "",
      html,
    };
    if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);

    sendSuccessResponse(res, "Verification code successfully sent");
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

    if (verificationCode !== user.verificationCode)
      throw new UnauthorizedError("Invalid or expired verification code");

    if (
      compareDates(user.verificationExpires || new Date(), new Date(), "before")
    )
      throw new UnauthorizedError("Invalid or expired verification code");

    await prisma.user.update({
      where: { email },
      data: { isVerified: true, verificationCode: "0" },
    });

    const html = render("welcome", {
      fullName: user.fullName,
      verificationCode,
      currentYear: new Date().getFullYear(),
    });
    const mailOptions: MailInterface = {
      to: email,
      from: `"Penetralia" samzdevop@yahoo.com`,
      subject: "Welcome to Agritech Africa",
      text: "",
      html,
    };
    if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);
    sendSuccessResponse(res, "Account verification successful");
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { newPassword, confirmPassword } = req.body;

    // Validate new password confirmation
    if (newPassword !== confirmPassword) {
      throw new BadRequestError('New password and confirmation do not match');
    }

    // Validate new password length
    if (newPassword.length < 8) {
      throw new BadRequestError('New password must be at least 8 characters long');
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // select: { ...userSelect, password: true }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    // const isCurrentPasswordValid = await verify(
    //   user.password || "$passwordless",
    //   currentPassword
    // );

    // if (!isCurrentPasswordValid) {
    //   throw new UnauthorizedError('Current password is incorrect');
    // }

    // Hash new password
    const hashedNewPassword = await hash(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    sendSuccessResponse(res, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};




export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, password, confirmPassword, verificationCode } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");

    if (password !== confirmPassword)
      throw new BadRequestError(`Password don't match`);

    if (verificationCode !== user.verificationCode)
      throw new UnauthorizedError("Invalid or expired verification code");

    if (
      compareDates(user.verificationExpires || new Date(), new Date(), "before")
    )
      throw new UnauthorizedError("Invalid or expired verification code");

    const hashedPassword = await hash(password);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, verificationCode: "0" },
    });

    const html = render("reset", {
      fullName: user.fullName,
      currentYear: new Date().getFullYear(),
    });
    const mailOptions: MailInterface = {
      to: email,
      from: `"Penetralia" samzdevop@yahoo.com`,
      subject: "Agritech Password Reset Successful",
      text: "",
      html,
    };
    if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);
    sendSuccessResponse(res, "Password reset successful");
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

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      sendSuccessResponse(res, "If an account with that email exists, a password reset link has been sent.");
      return;
    }

    // Generate reset token
    const resetToken = generateResetToken(email);
    
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Send email with reset link
    const html = render("password-reset", {
      fullName: user.fullName,
      resetLink,
      currentYear: new Date().getFullYear(),
    });
    
    const mailOptions: MailInterface = {
      to: email,
      from: `"Agritech" ${process.env.SMTP_FROM_EMAIL || 'noreply@agritech.com'}`,
      subject: "Reset Your Agritech Password",
      text: `Click the following link to reset your password: ${resetLink}`,
      html,
    };

    if (process.env.NODE_ENV !== "test") {
      await sendCustomMail(mailOptions);
    }

    sendSuccessResponse(
      res,
      "If an account with that email exists, a password reset link has been sent."
    );
  } catch (error) {
    next(error);
  }
};