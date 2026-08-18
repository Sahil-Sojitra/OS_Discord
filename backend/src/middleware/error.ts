import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Handle AppError (e.g. UnauthorizedError, NotFoundError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.constructor.name,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'ValidationError',
        message: 'Validation failed',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Handle Mongoose / MongoDB invalid ObjectId format (CastError)
  if (err.name === 'CastError') {
    res.status(404).json({
      error: {
        code: 'NotFoundError',
        message: 'Room not found',
      },
    });
    return;
  }

  // Handle Mongoose / MongoDB duplicate key errors (E11000)
  const errAny = err as any;
  if (errAny.code === 11000) {
    const keys = Object.keys(errAny.keyValue || {});
    const field = keys[0] || 'field';
    res.status(400).json({
      error: {
        code: 'ConflictError',
        message: `This ${field} is already taken.`,
      },
    });
    return;
  }

  // Handle unexpected internal server crashes
  logger.error(err, `Unhandled error encountered on ${req.method} ${req.url}`);

  res.status(500).json({
    error: {
      code: 'InternalServerError',
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    },
  });
};
