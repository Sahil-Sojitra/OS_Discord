import { Socket, Server } from 'socket.io';
import { isRoomMember } from '../../modules/rooms/room.service.js';
import * as messageService from '../../modules/messages/message.service.js';
import { logger } from '../../utils/logger.js';
import { sendMessageSchema } from '../../modules/messages/validators.js';

export const registerMessageHandlers = (socket: Socket, io: Server) => {
  const userId = socket.data.userId;

  // Handle live message send event
  socket.on('message:send', async (payload: unknown, ack: unknown) => {
    const ackFn = typeof ack === 'function' ? ack : () => {};
    try {
      // Validate inputs using sendMessageSchema Zod schema
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) {
        ackFn({
          status: 'error',
          message: parsed.error.issues[0]?.message || 'Invalid message payload',
        });
        return;
      }

      const { roomId, content, tempId } = parsed.data;

      // Authorize message sending by verifying room membership status
      const isMember = await isRoomMember(roomId, userId);
      if (!isMember) {
        ackFn({
          status: 'error',
          message: 'Access denied: You are not a member of this room',
        });
        return;
      }

      // Create and save message (populates sender object automatically)
      const message = await messageService.createMessage(userId, roomId, content);
      logger.info({ userId, roomId, messageId: message.id }, 'Socket message created and saved');

      // Broadcast the new message event to all sockets in the room (including the sender)
      io.to(roomId).emit('message:new', { message });

      // Acknowledge send success directly to sender, passing back the tempId for UI matching
      ackFn({
        status: 'ok',
        tempId,
        message,
      });
    } catch (error: any) {
      logger.error({ error, userId, socketId: socket.id }, 'Error during socket message:send');
      socket.emit('error', { code: 'InternalError', message: 'Failed to send message' });
      ackFn({ status: 'error', message: 'Internal server error during send' });
    }
  });
};
