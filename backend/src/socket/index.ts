import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { User, IUser } from '../modules/auth/models/user.js';
import { registerRoomHandlers } from './handlers/rooms.js';
import { registerMessageHandlers } from './handlers/messages.js';

// Extend SocketIO's Socket interface to hold user data in data property
interface CustomSocket extends Socket {
  data: {
    userId: string;
    user: IUser;
  };
}

const tokenPayloadSchema = z.object({
  userId: z.string(),
});

let io: Server;

export const initSocketServer = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  // Handshake authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) {
        logger.warn({ socketId: socket.id }, 'Socket handshake rejected: No cookies found');
        return next(new Error('unauthorized'));
      }

      // Parse cookie header safely using cookie package
      const cookies = parseCookie(cookieHeader);
      const token = cookies.token;

      if (!token) {
        logger.warn({ socketId: socket.id }, 'Socket handshake rejected: Token cookie missing');
        return next(new Error('unauthorized'));
      }

      // Verify JWT signature
      const decoded = jwt.verify(token, env.JWT_SECRET);
      
      // Validate decoded payload schema
      const parsed = tokenPayloadSchema.safeParse(decoded);
      if (!parsed.success) {
        logger.warn({ socketId: socket.id }, 'Socket handshake rejected: Invalid token payload');
        return next(new Error('unauthorized'));
      }

      const { userId } = parsed.data;

      // Re-fetch user from database to ensure fresh session parameters (e.g. not deleted)
      const user = await User.findById(userId);
      if (!user) {
        logger.warn({ socketId: socket.id, userId }, 'Socket handshake rejected: User not found in DB');
        return next(new Error('unauthorized'));
      }

      // Attach credentials to socket context metadata
      socket.data.userId = user.id; // Map Mongoose ID to our clean mapped id string
      socket.data.user = user;

      next();
    } catch (err: any) {
      logger.error({ err, socketId: socket.id }, 'Socket handshake failed due to internal error');
      next(new Error('unauthorized'));
    }
  });

  // Handle successful connections
  io.on('connection', (socket: Socket) => {
    const customSocket = socket as CustomSocket;
    const { userId, user } = customSocket.data;

    logger.info(
      { socketId: socket.id, userId, username: user.username },
      'Socket client connected successfully'
    );

    // Register rooms and messages domain event handlers
    registerRoomHandlers(customSocket);
    registerMessageHandlers(customSocket, io);

    socket.on('disconnect', () => {
      logger.info(
        { socketId: socket.id, userId, username: user.username },
        'Socket client disconnected'
      );
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
};
