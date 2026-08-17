import { Request, Response, NextFunction, CookieOptions } from 'express';
import { env } from '../../config/env.js';
import * as authService from './auth.service.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await authService.registerUser(req.body);
    const token = authService.signToken(user._id.toString());
    
    res.cookie('token', token, cookieOptions);
    res.status(201).json({
      status: 'success',
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { user, token } = await authService.loginUser(req.body);
    
    res.cookie('token', token, cookieOptions);
    res.status(200).json({
      status: 'success',
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Promise<void> => {
  res.clearCookie('token', {
    ...cookieOptions,
    maxAge: undefined, // remove maxAge for clearing
  });

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
};

export const getMe = async (
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Promise<void> => {
  res.status(200).json({
    status: 'success',
    user: req.user,
  });
};
