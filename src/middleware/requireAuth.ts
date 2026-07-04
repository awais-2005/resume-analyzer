import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { HttpStatus } from '../utils/HttpStatus';
import { User } from '../models/User';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    const user = await User.findById(payload.userId);
    if (!user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    req.userId = payload.userId;
    req.user = user;

    console.log(`userId: ${req.userId} is authenticated`);
    next();
  } catch {
    next(new ApiError(HttpStatus.UNAUTHORIZED, 'Unauthorized'));
  }
}
