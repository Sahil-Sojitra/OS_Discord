import bcrypt from 'bcrypt';
import { Room, IRoom } from './models/room.js';
import { UnauthorizedError, NotFoundError } from '../../utils/errors.js';

export const isRoomMember = async (roomId: string, userId: string): Promise<boolean> => {
  const room = await Room.findOne({ _id: roomId, members: userId });
  return !!room;
};

export const createRoom = async (
  creatorId: string,
  name: string,
  password: string
): Promise<IRoom> => {
  const passwordHash = await bcrypt.hash(password, 10);
  
  const room = await Room.create({
    name,
    passwordHash,
    createdBy: creatorId,
    members: [creatorId], // Auto-join creator
  });

  return room;
};

export const joinRoom = async (
  userId: string,
  roomId: string,
  password: string
): Promise<void> => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new NotFoundError('Room not found');
  }

  // Idempotency check: if user is already a member, return success directly
  const alreadyMember = room.members.some((memberId) => memberId.toString() === userId);
  if (alreadyMember) {
    return;
  }

  // Verify room password (401 error if incorrect)
  const isPasswordValid = await bcrypt.compare(password, room.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid room password');
  }

  // Add user to the members list safely
  await Room.findByIdAndUpdate(roomId, {
    $addToSet: { members: userId },
  });
};

export const getMyRooms = async (userId: string): Promise<any[]> => {
  // Retrieve rooms where user is a member, selecting name, members, and createdAt
  const rooms = await Room.find(
    { members: userId },
    //douing this for the only fetching the 3 properties from the DB document
    { name: 1, members: 1, createdAt: 1 }
  ).sort({ createdAt: -1 });

  // Map to exclude the full members array from response, returning only memberCount
  return rooms.map((room) => {
    const obj = room.toJSON() as any;
    delete obj.members;
    return obj;
  });
};

export const getAllRooms = async (userId: string): Promise<any[]> => {
  // Retrieve all rooms, selecting name, members, and createdAt
  const rooms = await Room.find(
    {},
    { name: 1, members: 1, createdAt: 1 }
  ).sort({ createdAt: -1 });

  // Map to format response, calculating member count and membership status for the user
  return rooms.map((room) => {
    const obj = room.toJSON() as any;
    obj.isMember = room.members.some((memberId) => memberId.toString() === userId);
    delete obj.members;
    return obj;
  });
};

export const getRoomById = async (roomId: string): Promise<IRoom> => {
  const room = await Room.findById(roomId)
    .populate('members', 'username')
    .exec();

  if (!room) {
    throw new NotFoundError('Room not found');
  }

  return room;
};
