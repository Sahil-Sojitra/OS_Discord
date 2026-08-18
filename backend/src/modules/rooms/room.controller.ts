import { Request, Response, NextFunction } from 'express';
import * as roomService from './room.service.js';

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { name, password } = req.body;
    
    const room = await roomService.createRoom(userId, name, password);
    res.status(201).json({
      status: 'success',
      room,
    });
  } catch (error) {
    next(error);
  }
};

export const join = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const roomId = req.params.roomId;
    const { password } = req.body;

    await roomService.joinRoom(userId, roomId, password);
    res.status(200).json({
      status: 'success',
      message: 'Successfully joined room',
    });
  } catch (error) {
    next(error);
  }
};

export const listMine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const rooms = await roomService.getMyRooms(userId);

    res.status(200).json({
      status: 'success',
      rooms,
    });
  } catch (error) {
    next(error);
  }
};

export const listAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const rooms = await roomService.getAllRooms(userId);

    res.status(200).json({
      status: 'success',
      rooms,
    });
  } catch (error) {
    next(error);
  }
};

export const getDetail = async (
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Promise<void> => {
  // requireRoomMember middleware already fetched the populated room and mounted it onto req.room
  res.status(200).json({
    status: 'success',
    room: req.room,
  });
};
