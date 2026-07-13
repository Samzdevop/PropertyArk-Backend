import prisma from "../prisma";
import { hash, verify } from "argon2";
import { BadRequestError } from "../errors/BadRequestError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import Logger from "../config/logger";

export class UserService {
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        email: true,
        fullName: true,
      },
    });

    if (!user) {
      throw new BadRequestError("User not found");
    }

    if (!user.password) {
      throw new BadRequestError("This account uses Google login. Please use Google to sign in or set a password first.");
    }
    const isPasswordValid = await verify(user.password, currentPassword);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }
    const hashedNewPassword = await hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    Logger.info(`Password changed successfully for user: ${user.email}`);
  }
}