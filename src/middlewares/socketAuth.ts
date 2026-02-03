import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

export class SocketAuth {
  static async authenticate(socket: Socket, next: Function): Promise<void> {
    try {
        console.log(`🔐 [SocketAuth] Starting authentication...`);
      const token = socket.handshake.auth.token || 
        socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          isVerified: true,
          isSuspended: true,
          companyId: true,
          avatar: true
        }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.isSuspended) {
        return next(new Error('Authentication error: Account suspended'));
      }
      
      socket.data.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  }
}