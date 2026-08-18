import { Request, Response, NextFunction } from 'express';
import { isRoomMember, getRoomById } from '../modules/rooms/room.service.js';
import { IRoom } from '../modules/rooms/models/room.js';
import { NotFoundError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      room?: IRoom;
    }
  }
}

export const requireRoomMember = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.roomId;
    const userId = req.user?._id?.toString();

    if (!userId || !roomId) {
      throw new NotFoundError('Room not found');
    }

    // Check membership status
    const isMember = await isRoomMember(roomId, userId);
    if (!isMember) {
      // Mask existence with 404 to deny scan-access to unauthorized rooms
      throw new NotFoundError('Room not found');
    }

    // Load full room details and mount onto request
    const room = await getRoomById(roomId);
    req.room = room;
    next();
  } catch (error: any) {
    // Handle invalid ObjectId format gracefully as a 404 instead of 500
    if (error?.name === 'CastError') {
      next(new NotFoundError('Room not found'));
      return;
    }
    next(error);
  }
};
