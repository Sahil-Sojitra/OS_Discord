import { Server } from 'socket.io';

export interface PresenceUser {
  userId: string;
  username: string;
}

/**
 * Retrieves all unique users currently connected to a room
 */
export const getRoomPresence = async (io: Server, roomId: string): Promise<PresenceUser[]> => {
  const sockets = await io.in(roomId).fetchSockets();
  
  // Deduplicate by userId
  const uniqueUsersMap = new Map<string, string>();
  for (const socket of sockets) {
    const userId = socket.data.userId;
    const username = socket.data.user?.username;
    if (userId && username) {
      uniqueUsersMap.set(userId, username);
    }
  }

  return Array.from(uniqueUsersMap.entries()).map(([userId, username]) => ({
    userId,
    username,
  }));
};

/**
 * Checks if the user has only one active socket in the room (first arrival)
 */
export const isUserFirstSocketInRoom = async (
  io: Server,
  roomId: string,
  userId: string
): Promise<boolean> => {
  const sockets = await io.in(roomId).fetchSockets();
  const userSockets = sockets.filter((socket) => socket.data.userId === userId);
  return userSockets.length === 1;
};

/**
 * Checks if the user has no active sockets remaining in the room (last departure)
 */
export const isUserLastSocketInRoom = async (
  io: Server,
  roomId: string,
  userId: string
): Promise<boolean> => {
  const sockets = await io.in(roomId).fetchSockets();
  const userSockets = sockets.filter((socket) => socket.data.userId === userId);
  return userSockets.length === 0;
};
