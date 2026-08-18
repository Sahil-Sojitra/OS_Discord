import { Socket } from 'socket.io';
import { z } from 'zod';
import { Types } from 'mongoose';
import { isRoomMember } from '../../modules/rooms/room.service.js';
import { logger } from '../../utils/logger.js';

const roomIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid room ID format',
});

export const registerRoomHandlers = (socket: Socket) => {
  const userId = socket.data.userId;
  const username = socket.data.user.username;

  // Handle room join requests
  socket.on('room:join', async (payload: unknown, ack: unknown) => {
    const ackFn = typeof ack === 'function' ? ack : () => {};
    try {
      // Validate payload structure
      const parsed = z.object({ roomId: roomIdSchema }).safeParse(payload);
      if (!parsed.success) {
        ackFn({
          status: 'error',
          message: parsed.error.issues[0]?.message || 'Invalid payload',
        });
        return;
      }

      const { roomId } = parsed.data;

      // Authorize: check if user is a member of the room
      const isMember = await isRoomMember(roomId, userId);
      if (!isMember) {
        ackFn({
          status: 'error',
          message: 'Access denied: You are not a member of this room',
        });
        return;
      }

      // Join the socket room
      await socket.join(roomId);
      logger.info({ userId, roomId, socketId: socket.id }, 'Socket joined room');

      // Broadcast user:joined to everyone else in the room
      socket.to(roomId).emit('user:joined', {
        userId,
        username,
        roomId,
      });

      ackFn({ status: 'ok' });
    } catch (error: any) {
      logger.error({ error, userId, socketId: socket.id }, 'Error during socket room:join');
      socket.emit('error', { code: 'InternalError', message: 'Failed to join room' });
      ackFn({ status: 'error', message: 'Internal server error during join' });
    }
  });

  // Handle room leave requests
  socket.on('room:leave', async (payload: unknown, ack: unknown) => {
    const ackFn = typeof ack === 'function' ? ack : () => {};
    try {
      const parsed = z.object({ roomId: roomIdSchema }).safeParse(payload);
      if (!parsed.success) {
        ackFn({
          status: 'error',
          message: parsed.error.issues[0]?.message || 'Invalid payload',
        });
        return;
      }

      const { roomId } = parsed.data;

      // Leave the socket room
      await socket.leave(roomId);
      logger.info({ userId, roomId, socketId: socket.id }, 'Socket left room');

      // Broadcast user:left to everyone else in the room
      socket.to(roomId).emit('user:left', {
        userId,
        username,
        roomId,
      });

      ackFn({ status: 'ok' });
    } catch (error: any) {
      logger.error({ error, userId, socketId: socket.id }, 'Error during socket room:leave');
      socket.emit('error', { code: 'InternalError', message: 'Failed to leave room' });
      ackFn({ status: 'error', message: 'Internal server error during leave' });
    }
  });

  // Handle socket disconnect (in-flight disconnect broadcasts before room lists clear)
  socket.on('disconnecting', () => {
    try {
      // socket.rooms is a Set containing all joined rooms (including the private socket.id room)
      const rooms = Array.from(socket.rooms).filter((roomId) => roomId !== socket.id);
      for (const roomId of rooms) {
        socket.to(roomId).emit('user:left', {
          userId,
          username,
          roomId,
        });
      }
      logger.info({ userId, socketId: socket.id, rooms }, 'Socket disconnecting, left all rooms');
    } catch (error) {
      logger.error({ error, userId, socketId: socket.id }, 'Error broadcasting disconnect leaves');
    }
  });
};
