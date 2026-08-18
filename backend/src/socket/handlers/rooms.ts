import { Socket, Server } from 'socket.io';
import { z } from 'zod';
import { Types } from 'mongoose';
import { isRoomMember } from '../../modules/rooms/room.service.js';
import { logger } from '../../utils/logger.js';
import {
  getRoomPresence,
  isUserFirstSocketInRoom,
  isUserLastSocketInRoom,
} from '../presence.js';

const roomIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid room ID format',
});

export const registerRoomHandlers = (socket: Socket, io: Server) => {
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

      // Authorize membership status
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

      // Deduplicate: check if this is the user's first socket connected to this room
      const isFirst = await isUserFirstSocketInRoom(io, roomId, userId);
      if (isFirst) {
        socket.to(roomId).emit('user:joined', {
          userId,
          username,
          roomId,
        });
      }

      // Return current online presence list in acknowledgment response
      const presence = await getRoomPresence(io, roomId);
      ackFn({ status: 'ok', presence });
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

      // Deduplicate: check if this was the user's last active socket in this room
      const isLast = await isUserLastSocketInRoom(io, roomId, userId);
      if (isLast) {
        socket.to(roomId).emit('user:left', {
          userId,
          username,
          roomId,
        });
      }

      ackFn({ status: 'ok' });
    } catch (error: any) {
      logger.error({ error, userId, socketId: socket.id }, 'Error during socket room:leave');
      socket.emit('error', { code: 'InternalError', message: 'Failed to leave room' });
      ackFn({ status: 'error', message: 'Internal server error during leave' });
    }
  });

  // Handle socket disconnect (asynchronous leaves + last-socket broadcasts)
  socket.on('disconnecting', async () => {
    try {
      // Snapshot rooms before disconnect teardown clears socket.rooms
      const rooms = Array.from(socket.rooms).filter((roomId) => roomId !== socket.id);
      
      for (const roomId of rooms) {
        // Disconnect this socket from the room first, so it is omitted from fetchSockets check
        await socket.leave(roomId);

        // Deduplicate: check if any other sockets remain for this user in the room
        const isLast = await isUserLastSocketInRoom(io, roomId, userId);
        if (isLast) {
          socket.to(roomId).emit('user:left', {
            userId,
            username,
            roomId,
          });
        }
      }
      logger.info({ userId, socketId: socket.id, rooms }, 'Socket disconnected, presence updated');
    } catch (error) {
      logger.error({ error, userId, socketId: socket.id }, 'Error during socket disconnect presence');
    }
  });
};
