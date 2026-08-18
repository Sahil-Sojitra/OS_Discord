import { Schema, model, Document, Types } from 'mongoose';

export interface IRoom extends Document {
  name: string;
  passwordHash: string;
  createdBy: Types.ObjectId;
  members: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const docObj = ret as any;
        docObj.id = docObj._id.toString();
        delete docObj._id;
        delete docObj.passwordHash;
        delete docObj.__v;
        if (docObj.members) {
          docObj.memberCount = docObj.members.length;
        }
        return docObj;
      },
    },
  }
);

// Index the members array for quick room querying per user
roomSchema.index({ members: 1 });

export const Room = model<IRoom>('Room', roomSchema);
