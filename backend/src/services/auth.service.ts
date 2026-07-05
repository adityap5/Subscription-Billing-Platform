import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/user.model';
import { getEnv } from '../config/env';
import { ApiError } from '../utils/apiError';
import { JwtPayload } from '../types';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 12;

function generateToken(user: IUser): string {
  const { JWT_SECRET, JWT_EXPIRES_IN } = getEnv();

  const payload: JwtPayload = {
    userId: user._id.toString(),
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<{ user: IUser; token: string }> {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    email,
    passwordHash,
    name,
  });

  const token = generateToken(user);

  logger.info('User registered', { userId: user._id.toString(), email });

  return { user, token };
}

export async function login(
  email: string,
  password: string
): Promise<{ user: IUser; token: string }> {
  const user = await User.findOne({ email });
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = generateToken(user);

  logger.info('User logged in', { userId: user._id.toString(), email });

  return { user, token };
}

export async function getUserById(userId: string): Promise<IUser | null> {
  return User.findById(userId).select('-passwordHash');
}