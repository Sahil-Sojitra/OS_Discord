import { Request, Response, NextFunction } from 'express';
import * as messageService from './message.service.js';
import { listMessagesQuerySchema } from './validators.js';

export const listHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.roomId;

    // Validate query parameters with listMessagesQuerySchema
    const query = listMessagesQuerySchema.parse(req.query);

    const messages = await messageService.listMessages(roomId, {
      before: query.before,
      limit: query.limit,
    });

    // If returned list length matches the requested limit, set nextCursor to the oldest message's id
    const nextCursor =
      messages.length > 0 && messages.length === query.limit
        ? messages[messages.length - 1].id
        : null;

    res.status(200).json({
      status: 'success',
      messages,
      nextCursor,
    });
  } catch (error) {
    next(error);
  }
};
