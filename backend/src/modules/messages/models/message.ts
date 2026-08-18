import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  roomId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const docObj = ret as any;
        docObj.id = docObj._id.toString();
        delete docObj._id;
        delete docObj.__v;
        return docObj;
      },
    },
  }
);

// Define compound index for cursor history querying (room lookup + reverse timestamp order)
messageSchema.index({ roomId: 1, _id: -1 });

export const Message = model<IMessage>('Message', messageSchema);
