import jwt from 'jsonwebtoken';
import { ApiError } from './ApiError';
import { HttpStatus } from './HttpStatus';

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET!;

export const signToken = (payload: { userId: string; email: string; name: string; picture?: string; googleId?: string }) => {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
};

export function verifyToken(token: string): JwtPayload {
  try {
    // Cast the returned verification object to your new JwtPayload interface
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid or expired token');
  }
}
