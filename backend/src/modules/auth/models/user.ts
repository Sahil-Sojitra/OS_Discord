import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret) => {
        const docObj = ret as any;
        docObj.id = docObj._id.toString();
        delete docObj._id;
        delete docObj.passwordHash;
        delete docObj.__v;
        return docObj;
      },
    },
  }
);

export const User = model<IUser>('User', userSchema);
