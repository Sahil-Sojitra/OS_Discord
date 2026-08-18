import { Message } from './models/message.js';

export const createMessage = async (
  senderId: string,
  roomId: string,
  content: string
): Promise<any> => {
  const message = await Message.create({
    senderId,
    roomId,
    content,
  });

  // Populate only the username of the sender user reference
  const populated = await message.populate('senderId', 'username');
  return populated.toJSON();
};

export const listMessages = async (
  roomId: string,
  query: { before?: string; limit: number }
): Promise<any[]> => {
  const filter: any = { roomId };

  // Cursor-based filter: select messages created before the given cursor message id
  if (query.before) {
    filter._id = { $lt: query.before };
  }

  const messages = await Message.find(filter)
    .sort({ _id: -1 }) // Retrieve newest first
    .limit(query.limit)
    .populate('senderId', 'username')
    .exec();

  // Convert mongoose documents to clean JSON representations
  return messages.map((msg) => msg.toJSON());
};
