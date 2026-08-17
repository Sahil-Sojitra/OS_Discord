import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { User, IUser } from './models/user.js';
import { RegisterInput, LoginInput } from './validators.js';
import { UnauthorizedError } from '../../utils/errors.js';

const jwtPayloadSchema = z.object({
  userId: z.string(),
});

export type JWTPayload = z.infer<typeof jwtPayloadSchema>;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const signToken = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const result = jwtPayloadSchema.safeParse(decoded);
    if (!result.success) {
      throw new UnauthorizedError('Invalid token structure');
    }
    return result.data;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
};

export const registerUser = async (input: RegisterInput): Promise<IUser> => {
  const passwordHash = await hashPassword(input.password);
  
  // Directly create the user and let Mongoose unique index catch duplicate usernames
  const user = await User.create({
    username: input.username,
    passwordHash,
  });

  return user;
};

export const loginUser = async (input: LoginInput): Promise<{ user: IUser; token: string }> => {
  const user = await User.findOne({ username: input.username.toLowerCase() });
  if (!user) {
    throw new UnauthorizedError('Invalid username or password');
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid username or password');
  }

  const token = signToken(user._id.toString());
  return { user, token };
};
