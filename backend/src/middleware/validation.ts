import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      // Re-assign req.body to the validated & coerced result
      req.body = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
};
