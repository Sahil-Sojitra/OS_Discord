import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid ID format',
});

export const sendMessageSchema = z.object({
  roomId: objectIdSchema,
  content: z
    .string({ required_error: 'Message content is required' })
    .trim()
    .min(1, 'Message content cannot be empty')
    .max(2000, 'Message content must be at most 2000 characters'),
  tempId: z.string({ required_error: 'Client temporary ID is required' }),
});

export const listMessagesQuerySchema = z.object({
  before: objectIdSchema.optional(),
  limit: z
    .preprocess(
      (val) => (val ? parseInt(val as string, 10) : undefined),
      z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')
    )
    .default(50),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMessagesQueryInput = z.infer<typeof listMessagesQuerySchema>;
