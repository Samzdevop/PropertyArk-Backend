import { UnauthorizedError } from '../errors/UnauthorizedError';
import jwt from 'jsonwebtoken';

interface TokenPayload {
    id: string;
    email?: string
    phone?: string
}

const generateToken = (user: TokenPayload): string => {
    return jwt.sign(
        {
            id: user.id,
             ...(user.email && {email: user.email}),
             ...(user.phone && {phone: user.phone })
        },
        process.env.JWT_SECRET as string,
        {
            expiresIn: process.env.JWT_EXPIRY || '1h',
        }
    );
};

export default generateToken;



export const generateResetToken = (email: string): string => {
  return jwt.sign(
    { email, type: 'password_reset' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' } // Token expires in 1 hour
  );
};

// Add this function to verify reset token
export const verifyResetToken = (token: string): { email: string; type: string } => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { email: string; type: string };
    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired reset token');
  }
};