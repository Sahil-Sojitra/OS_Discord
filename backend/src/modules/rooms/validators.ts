import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z
    .string({ required_error: 'Room name is required' })
    .trim()
    .min(1, 'Room name cannot be empty')
    .max(30, 'Room name must be at most 30 characters'),
  password: z
    .string({ required_error: 'Room password is required' })
    .min(4, 'Room password must be at least 4 characters')
    .max(50, 'Room password is too long'),
});

export const joinRoomSchema = z.object({
  password: z
    .string({ required_error: 'Password is required to join' }),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
