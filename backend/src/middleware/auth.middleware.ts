import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../modules/auth/auth.service.js';
import { User, IUser } from '../modules/auth/models/user.js';
import { UnauthorizedError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      throw new UnauthorizedError('Access denied: No session token provided');
    }

    // Verify token shape using verifyToken (which validates using Zod internally)
    const { userId } = verifyToken(token);

    // Fetch fresh user from database on every request
    const user = await User.findById(userId);
    if (!user) {
      throw new UnauthorizedError('Access denied: User session invalid');
    }

    // Attach user instance to express request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
